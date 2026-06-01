import type { Filesystem } from '@code-quest/filesystem';
import type { SessionData, SessionReader } from './types.ts';

export abstract class FileReader implements SessionReader {
  protected readonly path: string;
  protected readonly fs: Filesystem;

  constructor(path: string, fs: Filesystem) {
    this.path = path;
    this.fs = fs;
  }

  async read(sessionId: string): Promise<SessionData> {
    const lines: string[] = [];
    try {
      for await (const line of this.fs.readLines(this.path)) {
        lines.push(line);
      }
    } catch (err) {
      throw new Error(`Cannot read file: ${err instanceof Error ? err.message : String(err)}`);
    }
    return this.decode(lines, sessionId);
  }

  protected abstract decode(lines: string[], sessionId: string): SessionData;
}
