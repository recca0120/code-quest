import type { RawEvent } from '@code-quest/summoner';
import type { Column } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../logger.ts';

const sessionPreviewSchema: z.ZodObject<{
  lastAssistant: z.ZodOptional<z.ZodString>;
  firstUser: z.ZodOptional<z.ZodString>;
}> = z.object({
  lastAssistant: z.string().optional(),
  firstUser: z.string().optional(),
});
export type SessionPreview = z.infer<typeof sessionPreviewSchema>;

const rawTextMessageSchema = z.object({
  type: z.string(),
  message: z.object({
    content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })),
  }),
});

/** Extract text content from a raw JSON entry if it matches the given type. */
export function extractTextFromRaw(raw: string, type: 'user' | 'assistant'): string | undefined {
  try {
    const result = rawTextMessageSchema.safeParse(JSON.parse(raw));
    if (!result.success || result.data.type !== type) return undefined;
    const textBlock = result.data.message.content.find((b) => b.type === 'text');
    return textBlock?.text;
  } catch (err) {
    logger.debug({ err }, 'failed to parse raw event content');
  }
  return undefined;
}

export const directionSchema: z.ZodEnum<{ in: 'in'; out: 'out'; err: 'err' }> = z.enum([
  'in',
  'out',
  'err',
]);

export interface BaseRawTable {
  id: Column;
  sessionId: Column;
  dir: Column;
  raw: Column;
  createdAt: Column;
}

export interface RawEventRepository {
  /**
   * Append a raw event. Returns the primary-key id of the inserted row.
   * If `id` is provided, the store uses it verbatim; otherwise one is generated.
   * Composite stores use this to share the same id across all backing stores,
   * so downstream references (e.g. raw_deltas.parent_id) remain consistent.
   */
  append(event: RawEvent, id?: string): Promise<string>;
  appendBatch(events: RawEvent[]): Promise<void>;
  getBySession(sessionId: string): Promise<RawEvent[]>;
  getPreview(sessionId: string): Promise<SessionPreview>;
  /**
   * Clone all events of `fromSessionId` under `toSessionId`. When `ids` is
   * supplied the Nth cloned row uses `ids[N]` as its primary key (aligned with
   * the row order returned by `getBySession`); otherwise ids are generated.
   * Composite stores use the shared-id variant so all backing stores end up
   * with identical primary keys.
   */
  cloneEvents(fromSessionId: string, toSessionId: string, ids?: string[]): Promise<void>;
  /** Returns true if the session has at least one stdout event of type "user" (stdout user echo). */
  hasUserEcho(sessionId: string): Promise<boolean>;
  /** Returns true if the session has any events (LIMIT 1, avoids loading all events). */
  hasEvents(sessionId: string): Promise<boolean>;
  /** Returns total event count for a session (COUNT query, avoids loading all events). */
  countBySession(sessionId: string): Promise<number>;
  /** Yields events in batches of `batchSize`. */
  streamBySession(sessionId: string, batchSize: number): AsyncGenerator<RawEvent[]>;
  /** Delete all events for a session. */
  deleteBySession(sessionId: string): Promise<void>;
}
