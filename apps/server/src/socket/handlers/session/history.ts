import type { TypedSocket } from '@code-quest/schemas';
import {
  type ClientMessage,
  contentBlockSchema,
  controlRequestEventSchema,
  EVENTS,
} from '@code-quest/schemas';
import type { ProviderAdapter, RawEvent } from '@code-quest/summoner';
import { isRecord } from '@code-quest/utils';
import { logger } from '../../../logger.ts';
import type { SessionPreview } from '../../../services/raw-event-repository.ts';
import type { RawEventStore } from '../../../services/raw-event-store.ts';
import type { SessionStore } from '../../../services/session-store.ts';
import type { Channel } from '../../channel.ts';
import { typedJsonObjectSchema, userMessageInputSchema } from '../../schemas.ts';

type RawEventDirection = RawEvent['direction'];

/** Events excluded from history replay — control requests (handled separately) and transient state. */
const HISTORY_EXCLUDE: Set<string> = new Set<string>([
  EVENTS.control.permission,
  EVENTS.control.elicitation,
  EVENTS.control.diff_review,
  EVENTS.control.mcp,
  EVENTS.control.cancel,
  EVENTS.control.hook_callback,
  EVENTS.session.status,
  EVENTS.stream.chunk,
  EVENTS.stream.block_start,
  EVENTS.stream.block_stop,
  EVENTS.stream.end,
  EVENTS.stream.message_start,
  EVENTS.stream.message_delta,
]);

/** Minimal surface SessionHistory needs from ChannelManager. */
interface ChannelLookup {
  get(id: string): Channel | undefined;
}

type ParsedEvent = { direction: RawEventDirection; obj: Record<string, unknown> };

export function extractPendingControlRequests(
  messages: ClientMessage[],
  respondedRequestIds: Set<string>,
): Array<{ requestId: string; message: ClientMessage }> {
  const pending: Array<{ requestId: string; message: ClientMessage }> = [];
  const cancelledIds = new Set(respondedRequestIds);

  for (const message of messages) {
    const isPending =
      message.name === EVENTS.control.permission || message.name === EVENTS.control.elicitation;
    const isCancel = message.name === EVENTS.control.cancel;
    if (!isPending && !isCancel) continue;

    const parsed = controlRequestEventSchema.safeParse(message.payload);
    if (!parsed.success) {
      logger.warn({ err: parsed.error, name: message.name }, 'Malformed control event in replay');
      continue;
    }
    if (isPending) pending.push({ requestId: parsed.data.requestId, message });
    else cancelledIds.add(parsed.data.requestId);
  }

  return pending.filter(({ requestId }) => !cancelledIds.has(requestId));
}

export function filterReplayEvents(
  parsed: ParsedEvent[],
  hasStdoutUserEcho: boolean,
): ParsedEvent[] {
  return parsed.filter((e) => e.direction === 'out' || !hasStdoutUserEcho);
}

function parseRawEvents(
  rawEvents: Array<{ raw: string; direction: RawEventDirection }>,
): Array<{ direction: RawEventDirection; obj: Record<string, unknown> }> {
  const parsed: Array<{ direction: RawEventDirection; obj: Record<string, unknown> }> = [];
  for (const event of rawEvents) {
    const trimmed = event.raw.trim();
    if (!trimmed) continue;
    try {
      const raw: unknown = JSON.parse(trimmed);
      if (!isRecord(raw)) continue;
      parsed.push({ direction: event.direction, obj: raw });
    } catch (err) {
      logger.debug({ err }, 'Skipping malformed raw event during replay');
    }
  }
  return parsed;
}

export class SessionHistory {
  private rawEventService: RawEventStore;
  private sessionStore: SessionStore;
  private adapter: ProviderAdapter;
  private channels: ChannelLookup;
  private batchSize: number;
  constructor(
    rawEventService: RawEventStore,
    sessionStore: SessionStore,
    adapter: ProviderAdapter,
    channels: ChannelLookup,
    batchSize = 1000,
  ) {
    this.rawEventService = rawEventService;
    this.sessionStore = sessionStore;
    this.adapter = adapter;
    this.channels = channels;
    this.batchSize = batchSize;
  }

  async resolveSessionId(channelId: string): Promise<string> {
    const channel = this.channels.get(channelId);
    if (channel?.sessionId) return channel.sessionId;
    const record = await this.sessionStore.getByChannelId(channelId);
    return record?.id ?? channelId;
  }

  async getSessionHistory(channelId: string): Promise<ClientMessage[]> {
    const sessionId = await this.resolveSessionId(channelId);
    const all = await this.replaySession(sessionId);
    return all.filter((e) => !HISTORY_EXCLUDE.has(e.name));
  }

  async *streamSessionHistory(channelId: string): AsyncGenerator<ClientMessage[]> {
    const sessionId = await this.resolveSessionId(channelId);
    const hasEcho = await this.rawEventService.hasUserEcho(sessionId);
    let yielded = false;
    for await (const rawBatch of this.rawEventService.streamBySession(sessionId, this.batchSize)) {
      const messages = this.replayParsed(parseRawEvents(rawBatch), hasEcho).filter(
        (e) => !HISTORY_EXCLUDE.has(e.name),
      );
      yield messages;
      yielded = true;
    }
    if (!yielded) yield [];
  }

  async getPreview(sessionId: string): Promise<SessionPreview> {
    return this.rawEventService.getPreview(sessionId);
  }

  async getRawEvents(channelId: string): Promise<Array<{ direction: string; raw: string }>> {
    const sessionId = await this.resolveSessionId(channelId);
    return this.rawEventService.getBySession(sessionId);
  }

  async getPendingReplayMessages(sessionId: string): Promise<{
    messages: ClientMessage[];
    respondedRequestIds: Set<string>;
  }> {
    const rawEvents = await this.rawEventService.getBySession(sessionId);
    const parsed = parseRawEvents(rawEvents);
    return {
      messages: this.replayParsed(parsed),
      respondedRequestIds: this.adapter.extractRespondedRequestIds(parsed),
    };
  }

  private async replaySession(sessionId: string): Promise<ClientMessage[]> {
    const rawEvents = await this.rawEventService.getBySession(sessionId);
    return this.replayEvents(rawEvents);
  }

  private replayStdoutEvent(raw: Record<string, unknown>, result: ClientMessage[]): void {
    const parsed = typedJsonObjectSchema.safeParse(raw);
    if (parsed.success) {
      const converted = this.adapter.transform(parsed.data).messages;
      result.push(...converted);
    }
  }

  private replayStdinEvent(raw: Record<string, unknown>, result: ClientMessage[]): void {
    const parsed = userMessageInputSchema.safeParse(raw);
    if (parsed.success) {
      const blocks = parsed.data.message.content.flatMap((b) => {
        const parsedBlock = contentBlockSchema.safeParse(b);
        return parsedBlock.success ? [parsedBlock.data] : [];
      });
      result.push({
        name: EVENTS.message.user,
        payload: { content: blocks },
      });
    }
  }

  private replayEvents(
    rawEvents: Array<{ raw: string; direction: RawEventDirection }>,
  ): ClientMessage[] {
    return this.replayParsed(parseRawEvents(rawEvents));
  }

  private replayParsed(parsed: ParsedEvent[], hasEcho?: boolean): ClientMessage[] {
    const hasStdoutUserEcho =
      hasEcho ?? parsed.some((e) => e.direction === 'out' && e.obj.type === 'user');
    const result: ClientMessage[] = [];
    for (const event of filterReplayEvents(parsed, hasStdoutUserEcho)) {
      if (event.direction === 'out') {
        this.replayStdoutEvent(event.obj, result);
      } else {
        this.replayStdinEvent(event.obj, result);
      }
    }
    return result;
  }

  async replayPendingControlRequests(
    socket: TypedSocket,
    channelId: string,
    sessionId: string,
  ): Promise<void> {
    const { messages, respondedRequestIds } = await this.getPendingReplayMessages(sessionId);

    const pendingRequests = extractPendingControlRequests(messages, respondedRequestIds);

    for (const { message } of pendingRequests) {
      socket.emit(message.name, {
        channelId,
        ...message.payload,
      });
    }
  }
}
