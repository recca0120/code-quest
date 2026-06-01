import type { RawEvent } from '@code-quest/summoner';
import { v7 as uuidv7 } from 'uuid';
import { CompositeStore } from './composite-store.ts';
import type { RawEventRepository, SessionPreview } from './raw-event-repository.ts';

export class CompositeRawEventStore
  extends CompositeStore<RawEventRepository>
  implements RawEventRepository
{
  async append(event: RawEvent, id?: string): Promise<string> {
    const rowId = id ?? uuidv7();
    await this.fanOut('raw event append', (s) => s.append(event, rowId));
    return rowId;
  }

  getBySession(sessionId: string): Promise<RawEvent[]> {
    return this.primary.getBySession(sessionId);
  }

  getPreview(sessionId: string): Promise<SessionPreview> {
    return this.primary.getPreview(sessionId);
  }

  countBySession(sessionId: string): Promise<number> {
    return this.primary.countBySession(sessionId);
  }

  hasEvents(sessionId: string): Promise<boolean> {
    return this.primary.hasEvents(sessionId);
  }

  hasUserEcho(sessionId: string): Promise<boolean> {
    return this.primary.hasUserEcho(sessionId);
  }

  streamBySession(sessionId: string, batchSize: number): AsyncGenerator<RawEvent[]> {
    return this.primary.streamBySession(sessionId, batchSize);
  }

  async cloneEvents(fromSessionId: string, toSessionId: string): Promise<void> {
    const rows = await this.primary.getBySession(fromSessionId);
    if (rows.length === 0) return;
    const ids = rows.map(() => uuidv7());
    await this.fanOut('raw event clone', (s) => s.cloneEvents(fromSessionId, toSessionId, ids));
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await this.fanOut('raw event delete', (s) => s.deleteBySession(sessionId));
  }
}
