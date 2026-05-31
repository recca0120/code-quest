import type { FileWatcher } from '@code-quest/file-watcher';
import type { OpenspecListResult } from '@code-quest/schemas';
import { DataSource } from '../data-source.ts';

export interface OpenspecLike {
  list(cwd: string): Promise<OpenspecListResult>;
}

export class OpenspecDataSource extends DataSource<OpenspecListResult> {
  private readonly openspec: OpenspecLike;

  constructor(cwd: string, watchService: FileWatcher, openspec: OpenspecLike) {
    super(cwd, watchService, (path) => /^openspec\//.test(path));
    this.openspec = openspec;
  }

  async read(): Promise<OpenspecListResult> {
    return this.openspec.list(this.cwd);
  }
}
