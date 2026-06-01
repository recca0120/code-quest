import type { Filesystem } from '@code-quest/filesystem';
import type { SessionData, SessionWriter } from '../types.ts';

export abstract class FileWriter implements SessionWriter {
  protected readonly outputPath: string;
  protected readonly fs: Filesystem;

  constructor(outputPath: string, fs: Filesystem) {
    this.outputPath = outputPath;
    this.fs = fs;
  }

  async write(sessionId: string, data: SessionData): Promise<void> {
    const content = this.encode(sessionId, data);
    const result = await this.fs.writeFile(this.outputPath, content);
    if ('error' in result) throw new Error(`Cannot write file: ${result.error}`);
  }

  protected abstract encode(sessionId: string, data: SessionData): string;
}
