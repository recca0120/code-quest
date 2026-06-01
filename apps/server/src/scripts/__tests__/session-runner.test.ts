import { RootGuardFilesystem } from '@code-quest/filesystem';
import { JsonlProjectScanner, SessionMigrator } from '@code-quest/session-store';
import { FakeFilesystem } from '@code-quest/test-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { DbProjectScanner } from '../../services/db-project-scanner.ts';
import { DbSessionReader } from '../../services/db-session-reader.ts';
import { DbSessionWriter } from '../../services/db-session-writer.ts';
import type { RawEventStore } from '../../services/raw-event-store.ts';
import type { SessionStore } from '../../services/session-store.ts';
import { SessionTransfer } from '../../services/session-transfer.ts';
import { createTestContainer } from '../../test/create-test-container.ts';
import { TYPES } from '../../types.ts';
import { SessionRunner } from '../session-runner.ts';

const PROJECTS_DIR = '/home/.claude/projects';
const PROJECT_DIR = `${PROJECTS_DIR}/-Users-alice-repo`;
const SESSION_A = 'aaaaaaaa-0000-0000-0000-000000000001';

function makeJsonlLine(sessionId: string): string {
  return JSON.stringify({
    type: 'user',
    sessionId,
    cwd: '/Users/alice/repo',
    timestamp: '2026-01-01T00:00:00.000Z',
  });
}

describe('SessionRunner', () => {
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

  it('can be constructed with scanner and transfer', () => {
    const guardedFs = new RootGuardFilesystem(fakeFs, () => fakeFs.getRoots());
    const source = new JsonlProjectScanner(guardedFs, PROJECTS_DIR);
    const target = new DbProjectScanner(rawEventService, sessionStore);
    const scanner = new SessionMigrator(source, target);
    const reader = new DbSessionReader(rawEventService, sessionStore);
    const writer = new DbSessionWriter(rawEventService, sessionStore);
    const transfer = new SessionTransfer(reader, writer, fakeFs);
    const runner = new SessionRunner(scanner, transfer);
    expect(runner).toBeInstanceOf(SessionRunner);
  });
});
