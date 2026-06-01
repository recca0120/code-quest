import type { SessionData, SessionReader } from '@code-quest/session-store';
import { makeDefaultSessionRecord } from '@code-quest/session-store';
import type { RawEventStore } from './raw-event-store.ts';
import type { SessionStore } from './session-store.ts';

export class DbSessionReader implements SessionReader {
  private readonly rawEventService: RawEventStore;
  private readonly sessionStore: SessionStore;
  constructor(rawEventService: RawEventStore, sessionStore: SessionStore) {
    this.rawEventService = rawEventService;
    this.sessionStore = sessionStore;
  }

  async read(sessionId: string): Promise<SessionData> {
    const [events, session] = await Promise.all([
      this.rawEventService.getBySession(sessionId),
      this.sessionStore.getById(sessionId),
    ]);

    const record = session
      ? { ...session, cwd: session.cwd ?? '', projectRoot: session.projectRoot ?? '' }
      : makeDefaultSessionRecord(sessionId);

    return { events, record };
  }
}
