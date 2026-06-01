import type { ProjectList } from '@code-quest/session-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DbProjectList } from '../db-project-list.ts';
import type { RawEventStore } from '../raw-event-store.ts';
import type { SessionRecord, SessionStore } from '../session-store.ts';

function makeSession(
  overrides: Partial<SessionRecord & { cwd: string | null }> = {},
): SessionRecord {
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
  } as SessionRecord;
}

function mockSessionStore(sessions: SessionRecord[] = []): SessionStore {
  return {
    list: vi.fn(async () => ({ sessions, total: sessions.length })),
    getById: vi.fn(async (id) => sessions.find((s) => s.id === id) ?? null),
    upsert: vi.fn(async () => {}),
    deleteById: vi.fn(async () => {}),
  } as unknown as SessionStore;
}

function mockRawEventStore(count = 0): RawEventStore {
  return {
    countBySession: vi.fn(async () => count),
  } as unknown as RawEventStore;
}

describe('DbProjectList', () => {
  let sessionStore: SessionStore;
  let rawEventStore: RawEventStore;
  let list: ProjectList;

  beforeEach(() => {
    sessionStore = mockSessionStore([
      makeSession({ id: 'sess-1', projectRoot: '/project-a' }),
      makeSession({ id: 'sess-2', projectRoot: '/project-a' }),
      makeSession({ id: 'sess-3', projectRoot: '/project-b' }),
    ]);
    rawEventStore = mockRawEventStore(5);
    list = new DbProjectList(rawEventStore, sessionStore);
  });

  describe('scanProjects', () => {
    it('groups sessions by projectRoot', async () => {
      const projects = await list.scanProjects();
      expect(projects).toHaveLength(2);
      const a = projects.find((p) => p.cwd === '/project-a');
      expect(a?.sessions).toHaveLength(2);
      expect(projects.find((p) => p.cwd === '/project-b')?.sessions).toHaveLength(1);
    });

    it('each session summary has sessionId and createdAt', async () => {
      const projects = await list.scanProjects();
      const projectA = projects.find((p) => p.cwd === '/project-a');
      const session = projectA?.sessions[0];
      expect(session?.sessionId).toBe('sess-1');
      expect(session?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      const session2 = projectA?.sessions[1];
      expect(session2?.sessionId).toBe('sess-2');
      expect(session2?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('returns empty array when no sessions', async () => {
      list = new DbProjectList(rawEventStore, mockSessionStore([]));
      expect(await list.scanProjects()).toEqual([]);
    });

    it('skips sessions with empty projectRoot', async () => {
      list = new DbProjectList(
        rawEventStore,
        mockSessionStore([makeSession({ id: 'no-root', projectRoot: '' })]),
      );
      expect(await list.scanProjects()).toEqual([]);
    });
  });

  describe('hasSession', () => {
    it('returns true when session exists in store', async () => {
      expect(await list.hasSession('sess-1')).toBe(true);
    });

    it('returns false when session does not exist', async () => {
      expect(await list.hasSession('unknown')).toBe(false);
    });
  });

  describe('countEvents', () => {
    it('delegates to rawEventStore.countBySession', async () => {
      expect(await list.countEvents('sess-1')).toBe(5);
      expect(rawEventStore.countBySession).toHaveBeenCalledWith('sess-1');
    });
  });
});
