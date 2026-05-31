import { readFile } from 'node:fs/promises';
import type { DiffFile } from './types.ts';

interface MinimalLogger {
  debug(obj: object, msg: string): void;
}

export class LocalDiffFile implements DiffFile {
  private readonly logger: MinimalLogger | undefined;

  constructor(logger?: MinimalLogger) {
    this.logger = logger;
  }

  async read(path: string): Promise<string> {
    if (!path) return '';
    try {
      return await readFile(path, 'utf-8');
    } catch (err) {
      this.logger?.debug({ err, path }, 'Failed to read diff file');
      return '';
    }
  }
}
