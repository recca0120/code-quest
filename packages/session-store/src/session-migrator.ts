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
    const [targetProjects, sourceProjects] = await Promise.all([
      this.target.scanProjects(),
      this.source.scanProjects(),
    ]);
    if (targetProjects.length === 0) return [];

    const exportedIds = new Set(sourceProjects.flatMap((p) => p.sessions.map((s) => s.sessionId)));

    return targetProjects
      .map((p) => {
        const sessions = p.sessions.map((s) => {
          const filePath = s.filePath ?? '';
          return {
            session: s,
            filePath,
            status: (filePath && exportedIds.has(s.sessionId)
              ? 'EXPORTED'
              : 'NOT_EXPORTED') as ExportStatus,
          };
        });
        return {
          cwd: p.cwd,
          sessions,
          notExportedCount: sessions.filter((s) => s.status === 'NOT_EXPORTED').length,
        };
      })
      .filter((p) => p.sessions.length > 0);
  }

  private getImportStatus(session: SessionSummary, targetCount: number): ImportStatus {
    if (targetCount === 0) return 'NOT_IMPORTED';
    const threshold = session.decodableLines ?? 0;
    return targetCount >= threshold * IMPORT_THRESHOLD ? 'IMPORTED' : 'PARTIAL';
  }
}
