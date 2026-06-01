import { basename, extname, join } from 'node:path';
import type { Filesystem } from '@code-quest/filesystem';
import type { ProjectScanner, ProjectSummary, SessionSummary } from '../types.ts';
import { decodeProjectDir } from './project-dir.ts';

type SessionEntry = SessionSummary & { cwd: string };

export type SessionMeta = {
  title?: string;
  createdAt?: string;
  cwd: string;
  decodableLines: number;
};

export abstract class FileProjectScanner implements ProjectScanner {
  protected readonly fs: Filesystem;
  protected readonly baseDir: string;

  constructor(fs: Filesystem, baseDir: string) {
    this.fs = fs;
    this.baseDir = baseDir;
  }

  async hasSession(sessionId: string): Promise<boolean> {
    return (await this.findSessionFile(sessionId)) !== null;
  }

  async countEvents(sessionId: string): Promise<number> {
    const filePath = await this.findSessionFile(sessionId);
    if (!filePath) return 0;
    const result = await this.fs.readFileAbsolute(filePath);
    if ('error' in result) return 0;
    return this.extractMeta(result.content).decodableLines;
  }

  async scanProjects(): Promise<ProjectSummary[]> {
    const { directories } = await this.fs.browseEntries(this.baseDir);
    const results = await Promise.all(
      directories.map(async (dir) => {
        const sessions = await this.scanSessions(dir.path);
        if (sessions.length === 0) return null;
        const cwd = sessions[0]?.cwd || decodeProjectDir(dir.name);
        return { cwd, encodedDir: dir.name, sessions } as ProjectSummary;
      }),
    );
    return (results.filter(Boolean) as ProjectSummary[]).sort(
      (a, b) => b.sessions.length - a.sessions.length,
    );
  }

  private async findSessionFile(sessionId: string): Promise<string | null> {
    const { directories } = await this.fs.browseEntries(this.baseDir);
    const candidates = await Promise.all(
      directories.map(async (dir) => {
        const filePath = join(dir.path, `${sessionId}.jsonl`);
        return (await this.fs.exists(filePath)) ? filePath : null;
      }),
    );
    return candidates.find((p): p is string => p !== null) ?? null;
  }

  private async scanSessions(projectPath: string): Promise<SessionEntry[]> {
    const { files } = await this.fs.browseEntries(projectPath);
    const sessionFiles = files.filter((f) => this.isSessionFile(f.name));
    const results = await Promise.all(
      sessionFiles.map(async (file): Promise<SessionEntry | null> => {
        const result = await this.fs.readFile(projectPath, file.name);
        if ('error' in result) return null;
        const { title, createdAt, cwd, decodableLines } = this.extractMeta(result.content);
        return {
          sessionId: basename(file.name, extname(file.name)),
          filePath: file.path,
          title,
          createdAt,
          cwd,
          sizeBytes: result.content.length,
          decodableLines,
        };
      }),
    );
    const sessions = results.filter((s): s is SessionEntry => s !== null);
    return sessions.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  protected abstract isSessionFile(name: string): boolean;
  protected abstract extractMeta(content: string): SessionMeta;
}
