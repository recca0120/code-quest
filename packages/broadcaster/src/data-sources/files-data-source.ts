import type { FileWatcher } from '@code-quest/file-watcher';
import type { FileResult, Filesystem } from '@code-quest/filesystem';
import { DataSource, GIT_META_RE } from '../data-source.ts';

const IGNORE_RES: RegExp[] = [
  /^node_modules(\/|$)/,
  /^\.git\/objects(\/|$)/,
  /^\.git\/logs(\/|$)/,
  /^dist(\/|$)/,
  /^build(\/|$)/,
  /^out(\/|$)/,
  /^\.next(\/|$)/,
  /^\.turbo(\/|$)/,
  /^\.parcel-cache(\/|$)/,
  /\.log$/,
  /(^|\/)\.DS_Store$/,
];

function matchesFs(path: string): boolean {
  if (GIT_META_RE.test(path)) return false;
  for (const re of IGNORE_RES) if (re.test(path)) return false;
  return true;
}

export class FilesDataSource extends DataSource<FileResult[]> {
  private readonly pattern: string;
  private readonly fs: Filesystem;

  constructor(cwd: string, watchService: FileWatcher, fs: Filesystem, pattern = '') {
    super(cwd, watchService, matchesFs);
    this.pattern = pattern;
    this.fs = fs;
  }

  async read(): Promise<FileResult[]> {
    return this.fs.listFiles(this.cwd, this.pattern);
  }
}
