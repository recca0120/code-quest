import { join } from 'node:path';
import { RootGuardFilesystem } from '@code-quest/filesystem';
import { FakeFilesystem } from '@code-quest/test-kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonlProjectScanner } from '../project-scanner.ts';
import { SessionScanner } from '../session-scanner.ts';
import type { ProjectList, ProjectSummary } from '../types.ts';

const PROJECTS_DIR = '/home/.claude/projects';
const PROJECT_DIR = `${PROJECTS_DIR}/-Users-alice-repo`;
const SESSION_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const SESSION_B = 'bbbbbbbb-0000-0000-0000-000000000002';

function makeJsonlLine(sessionId: string, type = 'user'): string {
  return JSON.stringify({
    type,
    sessionId,
    cwd: '/Users/alice/repo',
    timestamp: '2026-01-01T00:00:00.000Z',
  });
}

function mockDbList(overrides: Partial<ProjectList> & { sessions?: string[] } = {}): ProjectList {
  const importedIds = overrides.sessions ?? [];
  return {
    scanProjects: vi.fn(
      async (): Promise<ProjectSummary[]> =>
        importedIds.length
          ? [{ cwd: '/db', sessions: importedIds.map((sessionId) => ({ sessionId })) }]
          : [],
    ),
    hasSession: vi.fn(async (id) => importedIds.includes(id)),
    countEvents: vi.fn(async () => 0),
    ...overrides,
  };
}

function makeScanner(dbProjects: ProjectList, fakeFs: FakeFilesystem) {
  const guardedFs = new RootGuardFilesystem(fakeFs, () => fakeFs.getRoots());
  const jsonlProjects = new JsonlProjectScanner(guardedFs, PROJECTS_DIR);
  return new SessionScanner(jsonlProjects, dbProjects);
}

describe('SessionScanner', () => {
  let fakeFs: FakeFilesystem;

  beforeEach(() => {
    fakeFs = new FakeFilesystem();
    fakeFs.setRoots([PROJECTS_DIR]);
    fakeFs.addDirectory(PROJECTS_DIR, ['-Users-alice-repo']);
    fakeFs.addDirectory(PROJECT_DIR, [`${SESSION_A}.jsonl`, `${SESSION_B}.jsonl`]);
    fakeFs.addFile(`${PROJECT_DIR}/${SESSION_A}.jsonl`, makeJsonlLine(SESSION_A));
    fakeFs.addFile(`${PROJECT_DIR}/${SESSION_B}.jsonl`, makeJsonlLine(SESSION_B));
  });

  describe('scanProjects', () => {
    it('returns projects with notImportedCount based on dbProjects.hasSession', async () => {
      const scanner = makeScanner(mockDbList({ sessions: [SESSION_A] }), fakeFs);
      const projects = await scanner.scanProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]!.notImportedCount).toBe(1); // only SESSION_B is not imported
    });

    it('returns notImportedCount=2 when nothing imported', async () => {
      const scanner = makeScanner(mockDbList(), fakeFs);
      const projects = await scanner.scanProjects();
      expect(projects[0]!.notImportedCount).toBe(2);
    });
  });

  describe('resolveImportStatuses', () => {
    it('returns NOT_IMPORTED when dbProjects.countEvents returns 0', async () => {
      const scanner = makeScanner(mockDbList(), fakeFs);
      const projects = await scanner.scanProjects();
      const statuses = await scanner.resolveImportStatuses(projects[0]!.sessions);
      expect(statuses.every((s) => s.status === 'NOT_IMPORTED')).toBe(true);
    });

    it('returns IMPORTED when countEvents meets threshold', async () => {
      const dbProjects = mockDbList({ sessions: [SESSION_A], countEvents: vi.fn(async () => 1) });
      const scanner = makeScanner(dbProjects, fakeFs);
      const projects = await scanner.scanProjects();
      const statuses = await scanner.resolveImportStatuses(projects[0]!.sessions);
      expect(statuses.find((s) => s.session.sessionId === SESSION_A)?.status).toBe('IMPORTED');
      expect(statuses.find((s) => s.session.sessionId === SESSION_B)?.status).toBe('NOT_IMPORTED');
    });
  });

  describe('scanExportable', () => {
    it('returns projects from dbProjects and checks filesystem for existence', async () => {
      const dbProjects = mockDbList({
        scanProjects: vi.fn(
          async (): Promise<ProjectSummary[]> => [
            {
              cwd: '/Users/alice/repo',
              sessions: [
                { sessionId: SESSION_A, jsonlPath: join(PROJECT_DIR, `${SESSION_A}.jsonl`) },
                { sessionId: SESSION_B, jsonlPath: join(PROJECT_DIR, `${SESSION_B}.jsonl`) },
              ],
            },
          ],
        ),
        hasSession: vi.fn(async () => false),
      });

      const scanner = makeScanner(dbProjects, fakeFs);
      const projects = await scanner.scanExportable();

      expect(projects).toHaveLength(1);
      expect(projects[0]!.sessions).toHaveLength(2);
    });

    it('marks session as EXPORTED when filesystem has the file', async () => {
      const dbProjects = mockDbList({
        scanProjects: vi.fn(
          async (): Promise<ProjectSummary[]> => [
            {
              cwd: '/Users/alice/repo',
              sessions: [
                { sessionId: SESSION_A, jsonlPath: join(PROJECT_DIR, `${SESSION_A}.jsonl`) },
              ],
            },
          ],
        ),
        hasSession: vi.fn(async () => false),
      });

      const scanner = makeScanner(dbProjects, fakeFs);
      const projects = await scanner.scanExportable();
      expect(projects[0]!.sessions[0]!.status).toBe('EXPORTED');
    });

    it('marks session as NOT_EXPORTED when file does not exist', async () => {
      const jsonlPath = join(PROJECT_DIR, 'nonexistent.jsonl');
      const dbProjects = mockDbList({
        scanProjects: vi.fn(
          async (): Promise<ProjectSummary[]> => [
            { cwd: '/Users/alice/repo', sessions: [{ sessionId: 'no-file', jsonlPath }] },
          ],
        ),
        hasSession: vi.fn(async () => false),
      });

      const scanner = makeScanner(dbProjects, fakeFs);
      const projects = await scanner.scanExportable();
      expect(projects[0]!.sessions[0]!.status).toBe('NOT_EXPORTED');
    });
  });
});
