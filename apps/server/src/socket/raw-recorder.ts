import { isRecord } from '@code-quest/utils';
import { logger } from '../logger.ts';
import type { RawEventStore } from '../services/raw-event-store.ts';
import type { Channel } from './channel.ts';
import { isDelta } from './raw-classifier.ts';

interface PendingEvent {
  raw: string;
  direction: 'in' | 'out' | 'err';
  timestamp: number;
}

function isUserStdin(raw: string, direction: 'in' | 'out' | 'err'): boolean {
  if (direction !== 'in') return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return false;
    return parsed.type === 'user';
  } catch {
    return false;
  }
}

/** Max raw events buffered before a sessionId arrives. If the CLI fails to
 *  emit session:init we'd otherwise grow unbounded; dropping oldest bounds
 *  memory while still capturing enough context to debug the failure. */
const PENDING_CAP = 1000;

export class RawRecorder {
  private service: RawEventStore;
  private writeDeltas: boolean;
  constructor(service: RawEventStore, writeDeltas: boolean) {
    this.service = service;
    this.writeDeltas = writeDeltas;
  }

  wire(channel: Channel): void {
    const { runner } = channel;
    let currentTurnRootId: string | null = null;
    let pendingDropWarned = false;
    const pendingEvents: PendingEvent[] = [];

    const persistOne = async (pending: PendingEvent, sessionId: string): Promise<void> => {
      if (isDelta(pending.raw)) {
        if (!this.writeDeltas) return;
        await this.service.appendDelta({
          parentId: currentTurnRootId ?? '',
          sessionId,
          direction: pending.direction,
          raw: pending.raw,
          timestamp: pending.timestamp,
        });
        return;
      }

      // Remember the user-stdin event's id as turn root so subsequent
      // deltas in the same turn can attribute to it via parentId.
      const id = await this.service.appendEvent({
        sessionId,
        direction: pending.direction,
        raw: pending.raw,
        timestamp: pending.timestamp,
      });
      if (isUserStdin(pending.raw, pending.direction)) {
        currentTurnRootId = id;
      }
    };

    const flushPending = async (sessionId: string): Promise<void> => {
      for (const pending of pendingEvents) {
        try {
          await persistOne(pending, sessionId);
        } catch (err) {
          logger.error({ err }, 'Failed to persist buffered raw event');
        }
      }
      pendingEvents.length = 0;
    };

    const recordRaw = (raw: string, direction: 'in' | 'out' | 'err'): void => {
      const sessionId = channel.sessionId;
      if (!sessionId) {
        if (pendingEvents.length >= PENDING_CAP) {
          pendingEvents.shift();
          if (!pendingDropWarned) {
            pendingDropWarned = true;
            logger.warn(
              { channelId: channel.channelId, cap: PENDING_CAP },
              'raw-recorder pending buffer hit cap; dropping oldest (session:init never arrived?)',
            );
          }
        }
        pendingEvents.push({ raw, direction, timestamp: Date.now() });
        return;
      }
      const next: PendingEvent = { raw, direction, timestamp: Date.now() };
      // Chain so buffered events flush before this one appends.
      const flush = pendingEvents.length > 0 ? flushPending(sessionId) : Promise.resolve();
      void flush
        .then(() => persistOne(next, sessionId))
        .catch((err) => logger.error({ err }, 'Failed to persist raw event'));
    };

    runner.on('stdout', (line: string) => recordRaw(line, 'out'));
    runner.on('stdin', (raw: string) => recordRaw(raw, 'in'));
    runner.on('stderr', (line: string) => {
      recordRaw(line, 'err');
      channel.lastError = line;
    });
  }
}
