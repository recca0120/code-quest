import { join } from 'node:path';
import { RootGuardFilesystem } from '@code-quest/filesystem';
import { FakeFilesystem } from '@code-quest/test-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { JsonlProjectScanner } from '../scanner/jsonl-project-scanner.ts';
import { SessionMigrator } from '../session-migrator.ts';
import type { ProjectScanner, ProjectSummary } from '../types.ts';

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

class StubProjectScanner implements ProjectScanner {
  private readonly projects: ProjectSummary[];
  constructor(projects: ProjectSummary[] = []) {
    this.projects = projects;
  }
  async scanProjects(): Promise<ProjectSummary[]> {
    return this.projects;
  }
  async hasSession(id: string): Promise<boolean> {
    return this.projects.some((p) => p.sessions.some((s) => s.sessionId === id));
  }
  async countEvents(id: string): Promise<number> {
    return (
      this.projects.flatMap((p) => p.sessions).find((s) => s.sessionId === id)?.decodableLines ?? 0
    );
  }
}

function makeScanner(target: ProjectScanner, fakeFs: FakeFilesystem, source?: ProjectScanner) {
  const guardedFs = new RootGuardFilesystem(fakeFs, () => fakeFs.getRoots());
  const resolvedSource = source ?? new JsonlProjectScanner(guardedFs, PROJECTS_DIR);
  return new SessionMigrator(resolvedSource, target);
}

describe('SessionMigrator', () => {
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
    it('returns projects with notImportedCount based on target sessions', async () => {
      const target = new StubProjectScanner([{ cwd: '/db', sessions: [{ sessionId: SESSION_A }] }]);
      const scanner = makeScanner(target, fakeFs);
      const projects = await scanner.scanProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]!.notImportedCount).toBe(1);
    });

    it('returns notImportedCount=2 when nothing imported', async () => {
      const scanner = makeScanner(new StubProjectScanner(), fakeFs);
      const projects = await scanner.scanProjects();
      expect(projects[0]!.notImportedCount).toBe(2);
    });
  });

  describe('resolveImportStatuses', () => {
    it('returns NOT_IMPORTED when target has no events for session', async () => {
      const scanner = makeScanner(new StubProjectScanner(), fakeFs);
      const projects = await scanner.scanProjects();
      const statuses = await scanner.resolveImportStatuses(projects[0]!.sessions);
      expect(statuses.every((s) => s.status === 'NOT_IMPORTED')).toBe(true);
    });

    it('returns IMPORTED when target countEvents meets threshold', async () => {
      const target = new StubProjectScanner([
        {
          cwd: '/db',
          sessions: [{ sessionId: SESSION_A, decodableLines: 1 }],
        },
      ]);
      const scanner = makeScanner(target, fakeFs);
      const projects = await scanner.scanProjects();
      const statuses = await scanner.resolveImportStatuses(projects[0]!.sessions);
      expect(statuses.find((s) => s.session.sessionId === SESSION_A)?.status).toBe('IMPORTED');
      expect(statuses.find((s) => s.session.sessionId === SESSION_B)?.status).toBe('NOT_IMPORTED');
    });
  });

  describe('scanExportable', () => {
    it('calls source.scanProjects once instead of hasSession per session', async () => {
      let scanCount = 0;
      let hasSessionCount = 0;
      const trackingSource: ProjectScanner = {
        async scanProjects() {
          scanCount++;
          return [{ cwd: '/Users/alice/repo', sessions: [{ sessionId: SESSION_A }] }];
        },
        async hasSession() {
          hasSessionCount++;
          return true;
        },
        async countEvents() {
          return 0;
        },
      };
      const target = new StubProjectScanner([
        {
          cwd: '/Users/alice/repo',
          sessions: [{ sessionId: SESSION_A }, { sessionId: SESSION_B }],
        },
      ]);

      await makeScanner(target, fakeFs, trackingSource).scanExportable();

      expect(scanCount).toBe(1);
      expect(hasSessionCount).toBe(0);
    });

    it('marks session as EXPORTED when session exists in source', async () => {
      const target = new StubProjectScanner([
        {
          cwd: '/Users/alice/repo',
          sessions: [{ sessionId: SESSION_A, filePath: join(PROJECT_DIR, `${SESSION_A}.jsonl`) }],
        },
      ]);
      const projects = await makeScanner(target, fakeFs).scanExportable();
      expect(projects[0]!.sessions[0]!.status).toBe('EXPORTED');
    });

    it('marks session as NOT_EXPORTED when file does not exist in source', async () => {
      const filePath = join(PROJECT_DIR, 'nonexistent.jsonl');
      const target = new StubProjectScanner([
        { cwd: '/Users/alice/repo', sessions: [{ sessionId: 'no-file', filePath }] },
      ]);
      const projects = await makeScanner(target, fakeFs).scanExportable();
      expect(projects[0]!.sessions[0]!.status).toBe('NOT_EXPORTED');
    });
  });
});
