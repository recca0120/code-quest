import type { RawEvent } from '@code-quest/summoner';
import type { RawDeltaEntry, RawDeltaRepository } from './raw-delta-repository.ts';
import type { RawEventRepository, SessionPreview } from './raw-event-repository.ts';

/**
 * Facade presenting a single public API over the split raw_events / raw_deltas
 * storage. Consumers treat this as "the event store"; the split is an
 * implementation detail they don't see.
 *
 * Write-side routing:
 *  - appendEvent  → raw_events (returns inserted id)
 *  - appendDelta  → raw_deltas (parent_id points at the user-stdin raw_events row)
 *
 * Read-side: `getBySession` returns the DB-level UNION ALL of both tables,
 * configured at the store layer. `cloneEvents` uses an events-only path
 * internally — forks carry conversation state, not token-stream debug data.
 */
export class RawEventStore {
  private readonly eventStore: RawEventRepository;
  private readonly deltaStore: RawDeltaRepository;
  constructor(eventStore: RawEventRepository, deltaStore: RawDeltaRepository) {
    this.eventStore = eventStore;
    this.deltaStore = deltaStore;
  }

  appendEvent(event: RawEvent, id?: string): Promise<string> {
    return this.eventStore.append(event, id);
  }

  appendEvents(events: RawEvent[]): Promise<void> {
    return this.eventStore.appendBatch(events);
  }

  appendDelta(entry: RawDeltaEntry): Promise<void> {
    return this.deltaStore.append(entry);
  }

  getBySession(sessionId: string): Promise<RawEvent[]> {
    return this.eventStore.getBySession(sessionId);
  }

  getPreview(sessionId: string): Promise<SessionPreview> {
    return this.eventStore.getPreview(sessionId);
  }

  cloneEvents(fromSessionId: string, toSessionId: string): Promise<void> {
    return this.eventStore.cloneEvents(fromSessionId, toSessionId);
  }

  countBySession(sessionId: string): Promise<number> {
    return this.eventStore.countBySession(sessionId);
  }

  hasEvents(sessionId: string): Promise<boolean> {
    return this.eventStore.hasEvents(sessionId);
  }

  hasUserEcho(sessionId: string): Promise<boolean> {
    return this.eventStore.hasUserEcho(sessionId);
  }

  streamBySession(sessionId: string, batchSize: number): AsyncGenerator<RawEvent[]> {
    return this.eventStore.streamBySession(sessionId, batchSize);
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await Promise.all([
      this.eventStore.deleteBySession(sessionId),
      this.deltaStore.deleteBySession(sessionId),
    ]);
  }
}
