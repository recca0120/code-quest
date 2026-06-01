import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LocalFilesystem, RootGuardFilesystem } from '@code-quest/filesystem';
import { JsonlFileReader } from '@code-quest/session-store';
import { FakeFilesystem } from '@code-quest/test-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContainer } from '../../test/create-test-container.ts';
import { TYPES } from '../../types.ts';
import { DbSessionReader } from '../db-session-reader.ts';
import { DbSessionWriter } from '../db-session-writer.ts';
import type { RawEventStore } from '../raw-event-store.ts';
import type { SessionStore } from '../session-store.ts';
import { SessionTransfer } from '../session-transfer.ts';

const PROJECTS_DIR = '/home/.claude/projects';
const PROJECT_DIR = `${PROJECTS_DIR}/-Users-alice-repo`;
const SESSION_A = 'aaaaaaaa-0000-0000-0000-000000000001';

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

function makeTransfer(
  rawEventService: RawEventStore,
  sessionStore: SessionStore,
  fakeFs: FakeFilesystem,
): SessionTransfer {
  const reader = new DbSessionReader(rawEventService, sessionStore);
  const writer = new DbSessionWriter(rawEventService, sessionStore);
  return new SessionTransfer(reader, writer, fakeFs);
}

describe('SessionTransfer', () => {
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
      const transfer = makeTransfer(rawEventService, sessionStore, fakeFs);
      await transfer.importSession(`${PROJECT_DIR}/${SESSION_A}.jsonl`);

      expect((await rawEventService.getBySession(SESSION_A)).length).toBe(1);
      expect((await sessionStore.getById(SESSION_A))?.id).toBe(SESSION_A);
    });

    it('imports real JSONL fixture — same result as direct file read', async () => {
      const realProjectDir = `${PROJECTS_DIR}/-real-session`;
      const realJsonlPath = `${realProjectDir}/${REAL_SESSION_ID}.jsonl`;
      fakeFs.addDirectory(`${PROJECTS_DIR}`, ['-real-session']);
      fakeFs.addDirectory(realProjectDir, [`${REAL_SESSION_ID}.jsonl`]);
      fakeFs.addFile(realJsonlPath, REAL_FIXTURE_CONTENT);

      await makeTransfer(rawEventService, sessionStore, fakeFs).importSession(realJsonlPath);

      const expected = await new JsonlFileReader(REAL_FIXTURE_PATH, new LocalFilesystem()).read(
        REAL_SESSION_ID,
      );
      expect((await rawEventService.getBySession(REAL_SESSION_ID)).length).toBe(
        expected.events.length,
      );
      expect((await sessionStore.getById(REAL_SESSION_ID))?.cwd).toBe(expected.record.cwd);
    });
  });

  describe('exportSession', () => {
    it('exports session from DB to filesystem', async () => {
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
      await makeTransfer(rawEventService, sessionStore, fakeFs).exportSession(
        SESSION_A,
        outputPath,
      );

      const lines = fakeFs.getFile(outputPath)!.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      expect(
        lines
          .map((l) => JSON.parse(l))
          .some((e) => e.sessionId === SESSION_A && e.cwd === '/Users/alice/repo'),
      ).toBe(true);
    });
  });
});
