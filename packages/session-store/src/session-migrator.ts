import type { ProjectScanner, ProjectSummary, SessionSummary } from './types.ts';

const IMPORT_THRESHOLD = 0.95;

export type ImportStatus = 'NOT_IMPORTED' | 'IMPORTED' | 'PARTIAL';
type ExportStatus = 'NOT_EXPORTED' | 'EXPORTED';

export interface ExportableSession {
  session: { sessionId: string; filePath?: string; createdAt?: string; title?: string | null };
  filePath: string;
  status: ExportStatus;
}

export interface ExportableProject {
  cwd: string;
  sessions: ExportableSession[];
  notExportedCount: number;
}

export interface ProjectInfo {
  cwd: string;
  encodedDir?: string;
  sessions: SessionSummary[];
  notImportedCount: number;
  importedIds: ReadonlySet<string>;
}

export interface ImportStatusEntry {
  session: SessionSummary;
  status: ImportStatus;
}

export class SessionMigrator {
  private readonly source: ProjectScanner;
  private readonly target: ProjectScanner;

  constructor(source: ProjectScanner, target: ProjectScanner) {
    this.source = source;
    this.target = target;
  }

  async scanProjects(): Promise<ProjectInfo[]> {
    const [sourceProjects, targetProjects] = await Promise.all([
      this.source.scanProjects(),
      this.target.scanProjects(),
    ]);
    const allImportedIds = new Set(
      targetProjects.flatMap((p) => p.sessions.map((s) => s.sessionId)),
    );
    return sourceProjects.map((p) => {
      const importedIds = new Set(
        p.sessions.map((s) => s.sessionId).filter((id) => allImportedIds.has(id)),
      );
      return {
        cwd: p.cwd,
        encodedDir: p.encodedDir,
        sessions: p.sessions,
        notImportedCount: p.sessions.length - importedIds.size,
        importedIds,
      };
    });
  }

  async resolveImportStatuses(
    sessions: SessionSummary[],
    importedIds?: ReadonlySet<string>,
  ): Promise<ImportStatusEntry[]> {
    return Promise.all(
      sessions.map(async (session) => {
        const isImported = importedIds
          ? importedIds.has(session.sessionId)
          : await this.target.hasSession(session.sessionId);
        const targetCount = isImported ? await this.target.countEvents(session.sessionId) : 0;
        return { session, status: this.getImportStatus(session, targetCount) };
      }),
    );
  }

  async scanExportable(): Promise<ExportableProject[]> {
    const dbProjects = await this.target.scanProjects();
    if (dbProjects.length === 0) return [];

    const projects = await Promise.all(
      dbProjects.map(async (p) => {
        const sessions = await this.buildExportableSessions(p);
        return {
          cwd: p.cwd,
          sessions,
          notExportedCount: sessions.filter((s) => s.status === 'NOT_EXPORTED').length,
        };
      }),
    );

    return projects.filter((p) => p.sessions.length > 0);
  }

  private async buildExportableSessions(project: ProjectSummary): Promise<ExportableSession[]> {
    return Promise.all(
      project.sessions.map(async (s) => {
        const filePath = s.filePath ?? '';
        const exists = filePath
          ? await this.source.hasSession(s.sessionId).catch(() => false)
          : false;
        return {
          session: s,
          filePath,
          status: exists ? 'EXPORTED' : 'NOT_EXPORTED',
        };
      }),
    );
  }

  private getImportStatus(session: SessionSummary, targetCount: number): ImportStatus {
    if (targetCount === 0) return 'NOT_IMPORTED';
    const threshold = session.decodableLines ?? 0;
    return targetCount >= threshold * IMPORT_THRESHOLD ? 'IMPORTED' : 'PARTIAL';
  }
}
