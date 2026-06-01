import type { ProjectList, ProjectSummary } from '@code-quest/session-store';
import type { RawEventStore } from './raw-event-store.ts';
import type { SessionStore } from './session-store.ts';

const SESSION_LIMIT = 10000;

export class DbProjectList implements ProjectList {
  private readonly rawEventStore: RawEventStore;
  private readonly sessionStore: SessionStore;

  constructor(rawEventStore: RawEventStore, sessionStore: SessionStore) {
    this.rawEventStore = rawEventStore;
    this.sessionStore = sessionStore;
  }

  async scanProjects(): Promise<ProjectSummary[]> {
    const { sessions } = await this.sessionStore.list({ limit: SESSION_LIMIT });
    const byCwd = new Map<string, ProjectSummary>();

    for (const s of sessions) {
      const cwd = s.projectRoot;
      if (!cwd) continue;
      let project = byCwd.get(cwd);
      if (!project) {
        project = { cwd, sessions: [] };
        byCwd.set(cwd, project);
      }
      project.sessions.push({ sessionId: s.id, createdAt: s.createdAt });
    }

    return [...byCwd.values()];
  }

  async hasSession(sessionId: string): Promise<boolean> {
    return (await this.sessionStore.getById(sessionId)) !== null;
  }

  async countEvents(sessionId: string): Promise<number> {
    return this.rawEventStore.countBySession(sessionId);
  }
}
