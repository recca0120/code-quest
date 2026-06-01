import { basename, join } from 'node:path';
import type { Filesystem } from '@code-quest/filesystem';
import { parseLine, parseLines } from './decoder.ts';
import { decodeProjectDir } from './project-dir.ts';
import type { ProjectList } from './types.ts';

export interface JsonlSession {
  sessionId: string;
  jsonlPath: string;
  title?: string;
  createdAt?: string;
  cwd: string;
  sizeBytes: number;
  decodableLines: number;
}

export interface JsonlProject {
  cwd: string;
  encodedDir: string;
  sessions: JsonlSession[];
}

function extractSessionMeta(lines: string[]): {
  title?: string;
  createdAt?: string;
  cwd: string;
  decodableLines: number;
} {
  let title: string | undefined;
  let createdAt: string | undefined;
  let cwd = '';
  let decodableLines = 0;
  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;
    if (entry.type === 'ai-title' && typeof entry.aiTitle === 'string') title = entry.aiTitle;
    if (!createdAt && typeof entry.timestamp === 'string') createdAt = entry.timestamp;
    if (!cwd && typeof entry.cwd === 'string') cwd = entry.cwd;
    decodableLines++;
  }
  return { title, createdAt, cwd, decodableLines };
}

export class JsonlProjectScanner implements ProjectList {
  private readonly fs: Filesystem;
  private readonly claudeProjectsDir: string;

  constructor(fs: Filesystem, claudeProjectsDir: string) {
    this.fs = fs;
    this.claudeProjectsDir = claudeProjectsDir;
  }

  async hasSession(sessionId: string): Promise<boolean> {
    return (await this.findSessionFile(sessionId)) !== null;
  }

  async countEvents(sessionId: string): Promise<number> {
    const filePath = await this.findSessionFile(sessionId);
    if (!filePath) return 0;
    const result = await this.fs.readFileAbsolute(filePath);
    if ('error' in result) return 0;
    return extractSessionMeta(parseLines(result.content)).decodableLines;
  }

  private async findSessionFile(sessionId: string): Promise<string | null> {
    const { directories } = await this.fs.browseEntries(this.claudeProjectsDir);
    const candidates = await Promise.all(
      directories.map(async (dir) => {
        const filePath = join(dir.path, `${sessionId}.jsonl`);
        return (await this.fs.exists(filePath)) ? filePath : null;
      }),
    );
    return candidates.find((p): p is string => p !== null) ?? null;
  }

  async scanProjects(): Promise<JsonlProject[]> {
    const { directories } = await this.fs.browseEntries(this.claudeProjectsDir);

    const results = await Promise.all(
      directories.map(async (dir) => {
        const sessions = await this.scanSessions(dir.path);
        if (sessions.length === 0) return null;
        // use cwd from first session's JSONL entry (avoids literal-dash ambiguity in directory name)
        const cwd = sessions[0]?.cwd || decodeProjectDir(dir.name);
        return { cwd, encodedDir: dir.name, sessions } satisfies JsonlProject;
      }),
    );

    return results
      .filter((p): p is JsonlProject => p !== null)
      .sort((a, b) => b.sessions.length - a.sessions.length);
  }

  private async scanSessions(projectPath: string): Promise<JsonlSession[]> {
    const { files } = await this.fs.browseEntries(projectPath);
    const jsonlFiles = files.filter(
      (f) => f.name.endsWith('.jsonl') && !f.name.startsWith('agent-'),
    );

    const results = await Promise.all(
      jsonlFiles.map(async (file): Promise<JsonlSession | null> => {
        const result = await this.fs.readFile(projectPath, file.name);
        if ('error' in result) return null;
        const lines = parseLines(result.content);
        const { title, createdAt, cwd, decodableLines } = extractSessionMeta(lines);
        return {
          sessionId: basename(file.name, '.jsonl'),
          jsonlPath: file.path,
          title,
          createdAt,
          cwd,
          sizeBytes: result.content.length,
          decodableLines,
        };
      }),
    );
    const sessions = results.filter((s): s is JsonlSession => s !== null);

    return sessions.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }
}
