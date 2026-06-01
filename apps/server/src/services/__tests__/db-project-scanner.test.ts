import type { ProjectScanner } from '@code-quest/session-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContainer } from '../../test/create-test-container.ts';
import { TYPES } from '../../types.ts';
import { DbProjectScanner } from '../db-project-scanner.ts';
import type { RawEventStore } from '../raw-event-store.ts';
import type { SessionRecord, SessionStore } from '../session-store.ts';

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'sess-1',
    channelId: 'ch',
    provider: 'anthropic',
    command: 'claude',
    args: '',
    cwd: '/tmp/project',
    projectRoot: '/tmp/project',
    mode: 'auto',
    role: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('DbProjectScanner', () => {
  let sessionStore: SessionStore;
  let rawEventStore: RawEventStore;
  let scanner: ProjectScanner;

  beforeEach(async () => {
    const container = createTestContainer();
    sessionStore = container.get<SessionStore>(TYPES.SessionStore);
    rawEventStore = container.get<RawEventStore>(TYPES.RawEventStore);

    await sessionStore.upsert(makeSession({ id: 'sess-1', projectRoot: '/project-a' }));
    await sessionStore.upsert(makeSession({ id: 'sess-2', projectRoot: '/project-a' }));
    await sessionStore.upsert(makeSession({ id: 'sess-3', projectRoot: '/project-b' }));

    scanner = new DbProjectScanner(rawEventStore, sessionStore);
  });

  describe('scanProjects', () => {
    it('groups sessions by projectRoot', async () => {
      const projects = await scanner.scanProjects();
      expect(projects).toHaveLength(2);
      expect(projects.find((p) => p.cwd === '/project-a')?.sessions).toHaveLength(2);
      expect(projects.find((p) => p.cwd === '/project-b')?.sessions).toHaveLength(1);
    });

    it('each session summary has sessionId and createdAt', async () => {
      const projects = await scanner.scanProjects();
      const projectA = projects.find((p) => p.cwd === '/project-a');
      expect(projectA?.sessions.map((s) => s.sessionId)).toContain('sess-1');
      expect(projectA?.sessions.map((s) => s.sessionId)).toContain('sess-2');
      expect(projectA?.sessions[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('returns empty array when no sessions', async () => {
      const emptyContainer = createTestContainer();
      const emptyScanner = new DbProjectScanner(
        emptyContainer.get<RawEventStore>(TYPES.RawEventStore),
        emptyContainer.get<SessionStore>(TYPES.SessionStore),
      );
      expect(await emptyScanner.scanProjects()).toEqual([]);
    });

    it('skips sessions with empty projectRoot', async () => {
      const emptyContainer = createTestContainer();
      const store = emptyContainer.get<SessionStore>(TYPES.SessionStore);
      await store.upsert(makeSession({ id: 'no-root', projectRoot: '' }));
      const emptyScanner = new DbProjectScanner(
        emptyContainer.get<RawEventStore>(TYPES.RawEventStore),
        store,
      );
      expect(await emptyScanner.scanProjects()).toEqual([]);
    });
  });

  describe('hasSession', () => {
    it('returns true when session exists in store', async () => {
      expect(await scanner.hasSession('sess-1')).toBe(true);
    });

    it('returns false when session does not exist', async () => {
      expect(await scanner.hasSession('unknown')).toBe(false);
    });
  });

  it('fetches all sessions across multiple pages when total exceeds one page', async () => {
    const container = createTestContainer();
    const store = container.get<SessionStore>(TYPES.SessionStore);
    const raw = container.get<RawEventStore>(TYPES.RawEventStore);
    // insert 5 sessions across 2 projects to test pagination
    for (let i = 1; i <= 5; i++) {
      await store.upsert(
        makeSession({ id: `page-sess-${i}`, projectRoot: i <= 3 ? '/proj-a' : '/proj-b' }),
      );
    }
    const paginatedScanner = new DbProjectScanner(raw, store, 2); // page size 2
    const projects = await paginatedScanner.scanProjects();
    expect(projects.find((p) => p.cwd === '/proj-a')?.sessions).toHaveLength(3);
    expect(projects.find((p) => p.cwd === '/proj-b')?.sessions).toHaveLength(2);
  });

  describe('countEvents', () => {
    it('returns event count from rawEventStore', async () => {
      await rawEventStore.appendEvent({
        sessionId: 'sess-1',
        direction: 'out',
        raw: '{}',
        timestamp: 0,
      });
      await rawEventStore.appendEvent({
        sessionId: 'sess-1',
        direction: 'out',
        raw: '{}',
        timestamp: 1,
      });
      expect(await scanner.countEvents('sess-1')).toBe(2);
    });
  });
});
