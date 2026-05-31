import type { FileWatcher } from '@code-quest/file-watcher';
import type { Git, GitStatusResult } from '@code-quest/git';
import { DataSource, GIT_META_RE } from '../data-source.ts';

export class GitDataSource extends DataSource<GitStatusResult> {
  private readonly git: Git;

  constructor(cwd: string, watchService: FileWatcher, git: Git) {
    super(cwd, watchService, (path) => GIT_META_RE.test(path));
    this.git = git;
  }

  async read(): Promise<GitStatusResult> {
    return this.git.status(this.cwd);
  }
}
