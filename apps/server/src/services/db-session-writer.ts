import type { SessionData, SessionWriter } from '@code-quest/session-store';
import type { RawEventStore } from './raw-event-store.ts';
import type { SessionStore } from './session-store.ts';

export class DbSessionWriter implements SessionWriter {
  private readonly rawEventService: RawEventStore;
  private readonly sessionStore: SessionStore;

  constructor(rawEventService: RawEventStore, sessionStore: SessionStore) {
    this.rawEventService = rawEventService;
    this.sessionStore = sessionStore;
  }

  async write(sessionId: string, data: SessionData): Promise<void> {
    // Skip entirely if any events already exist — re-importing a live session would cause duplicates.
    if (await this.rawEventService.hasEvents(sessionId)) return;

    await this.sessionStore.upsert(data.record);
    await this.rawEventService.appendEvents(data.events);
  }
}
