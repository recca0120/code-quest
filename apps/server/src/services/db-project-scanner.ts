import type { ProjectScanner, ProjectSummary } from '@code-quest/session-store';
import type { RawEventStore } from './raw-event-store.ts';
import type { SessionStore } from './session-store.ts';

const DEFAULT_PAGE_SIZE = 1000;

export class DbProjectScanner implements ProjectScanner {
  private readonly rawEventStore: RawEventStore;
  private readonly sessionStore: SessionStore;
  private readonly pageSize: number;

  constructor(
    rawEventStore: RawEventStore,
    sessionStore: SessionStore,
    pageSize: number = DEFAULT_PAGE_SIZE,
  ) {
    this.rawEventStore = rawEventStore;
    this.sessionStore = sessionStore;
    this.pageSize = pageSize;
  }

  async scanProjects(): Promise<ProjectSummary[]> {
    const byCwd = new Map<string, ProjectSummary>();
    let offset = 0;

    while (true) {
      const { sessions, total } = await this.sessionStore.list({ limit: this.pageSize, offset });
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
      offset += sessions.length;
      if (offset >= total) break;
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
