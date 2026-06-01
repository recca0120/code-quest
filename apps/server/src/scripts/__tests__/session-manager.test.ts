import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LocalFilesystem, RootGuardFilesystem } from '@code-quest/filesystem';
import { JsonlFileReader, JsonlProjectScanner, SessionMigrator } from '@code-quest/session-store';
import { FakeFilesystem } from '@code-quest/test-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { DbProjectScanner } from '../../services/db-project-scanner.ts';
import { DbSessionReader } from '../../services/db-session-reader.ts';
import { DbSessionWriter } from '../../services/db-session-writer.ts';
import type { RawEventStore } from '../../services/raw-event-store.ts';
import type { SessionStore } from '../../services/session-store.ts';
import { createTestContainer } from '../../test/create-test-container.ts';
import { TYPES } from '../../types.ts';
import { SessionManager } from '../session-manager.ts';

const PROJECTS_DIR = '/home/.claude/projects';
const PROJECT_DIR = `${PROJECTS_DIR}/-Users-alice-repo`;
const SESSION_A = 'aaaaaaaa-0000-0000-0000-000000000001';

// Real fixture
const REAL_FIXTURE_PATH = join(
  import.meta.dirname,
  '../../../../../packages/session-store/src/__tests__/fixtures/b3dbab57.jsonl',
);
const REAL_SESSION_ID = 'b3dbab57-8da8-40c9-86e8-11aadc1881e8';
const REAL_FIXTURE_CONTENT = readFileSync(REAL_FIXTURE_PATH, 'utf-8');

function makeJsonlLine(sessionId: string): string {
  return JSON.stringify({
    type: 'user',
    sessionId,
    cwd: '/Users/alice/repo',
    timestamp: '2026-01-01T00:00:00.000Z',
  });
}

function makeManager(
  rawEventService: RawEventStore,
  sessionStore: SessionStore,
  fakeFs: FakeFilesystem,
): SessionManager {
  const guardedFs = new RootGuardFilesystem(fakeFs, () => fakeFs.getRoots());
  const source = new JsonlProjectScanner(guardedFs, PROJECTS_DIR);
  const target = new DbProjectScanner(rawEventService, sessionStore);
  const scanner = new SessionMigrator(source, target);
  const reader = new DbSessionReader(rawEventService, sessionStore);
  const writer = new DbSessionWriter(rawEventService, sessionStore);
  return new SessionManager(scanner, reader, writer, fakeFs);
}

describe('SessionManager', () => {
  let rawEventService: RawEventStore;
  let sessionStore: SessionStore;
  let fakeFs: FakeFilesystem;

  beforeEach(() => {
    const container = createTestContainer();
    rawEventService = container.get<RawEventStore>(TYPES.RawEventStore);
    sessionStore = container.get<SessionStore>(TYPES.SessionStore);
    fakeFs = new FakeFilesystem();
    fakeFs.setRoots([PROJECTS_DIR]);
    fakeFs.addDirectory(PROJECTS_DIR, ['-Users-alice-repo']);
    fakeFs.addDirectory(PROJECT_DIR, [`${SESSION_A}.jsonl`]);
    fakeFs.addFile(`${PROJECT_DIR}/${SESSION_A}.jsonl`, makeJsonlLine(SESSION_A));
  });

  describe('importSession', () => {
    it('imports JSONL file into DB', async () => {
      const manager = makeManager(rawEventService, sessionStore, fakeFs);
      await manager.importSession(`${PROJECT_DIR}/${SESSION_A}.jsonl`);

      const events = await rawEventService.getBySession(SESSION_A);
      expect(events.length).toBe(1);
      const session = await sessionStore.getById(SESSION_A);
      expect(session?.id).toBe(SESSION_A);
    });

    it('imports real JSONL fixture via Filesystem interface — same result as direct file read', async () => {
      const realProjectDir = `${PROJECTS_DIR}/-real-session`;
      const realJsonlPath = `${realProjectDir}/${REAL_SESSION_ID}.jsonl`;
      fakeFs.addDirectory(`${PROJECTS_DIR}`, ['-real-session']);
      fakeFs.addDirectory(realProjectDir, [`${REAL_SESSION_ID}.jsonl`]);
      fakeFs.addFile(realJsonlPath, REAL_FIXTURE_CONTENT);

      const manager = makeManager(rawEventService, sessionStore, fakeFs);
      await manager.importSession(realJsonlPath);

      const expected = await new JsonlFileReader(REAL_FIXTURE_PATH, new LocalFilesystem()).read(
        REAL_SESSION_ID,
      );
      const actual = await rawEventService.getBySession(REAL_SESSION_ID);

      expect(actual.length).toBe(expected.events.length);
      expect(await sessionStore.getById(REAL_SESSION_ID)).toMatchObject({
        id: REAL_SESSION_ID,
        cwd: expected.record.cwd,
      });
    });
  });

  describe('exportSession', () => {
    it('exports session from DB via injected Filesystem', async () => {
      await sessionStore.upsert({
        id: SESSION_A,
        channelId: SESSION_A,
        provider: 'claude',
        command: 'claude',
        args: '[]',
        cwd: '/Users/alice/repo',
        projectRoot: '/Users/alice/repo',
        mode: 'interactive',
        role: 'chat',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      await rawEventService.appendEvent({
        sessionId: SESSION_A,
        direction: 'out',
        raw: JSON.stringify({
          type: 'assistant',
          sessionId: SESSION_A,
          message: { content: 'hi' },
        }),
        timestamp: 0,
      });

      const outputPath = `/fake/export-${SESSION_A}.jsonl`;
      const manager = makeManager(rawEventService, sessionStore, fakeFs);
      await manager.exportSession(SESSION_A, outputPath);

      const content = fakeFs.getFile(outputPath);
      expect(content).toBeDefined();
      const lines = content!.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      expect(JSON.parse(lines[0]!).sessionId).toBe(SESSION_A);
      expect(lines.some((l) => JSON.parse(l).sessionId === SESSION_A)).toBe(true);
      const parsed = lines.map((l) => JSON.parse(l));
      expect(parsed.some((e) => e.sessionId === SESSION_A && e.cwd === '/Users/alice/repo')).toBe(
        true,
      );
    });
  });
});
