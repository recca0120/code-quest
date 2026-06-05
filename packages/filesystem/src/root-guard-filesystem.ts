import { basename, resolve } from 'node:path';
import { isPathWithin } from './is-path-within.ts';
import type {
  DirectoryEntry,
  FileEntry,
  FileKind,
  FileResult,
  Filesystem,
  FsMutationResult,
  ReadFileOpts,
  ReadFileResult,
  WriteFileResult,
} from './types.ts';
import { PathOutsideRootsError } from './types.ts';

export class RootGuardFilesystem implements Filesystem {
  readonly filesystem: Filesystem;
  private readonly getRoots: () => readonly string[];

  constructor(filesystem: Filesystem, roots: readonly string[] | (() => readonly string[])) {
    this.filesystem = filesystem;
    this.getRoots = typeof roots === 'function' ? roots : () => roots;
  }

  private isWithin(path: string): boolean {
    return this.getRoots().some((root) => isPathWithin(root, path));
  }

  private guard(path: string): void {
    if (!this.isWithin(path)) throw new PathOutsideRootsError(path);
  }

  private rootEntries(): DirectoryEntry[] {
    return this.getRoots().map((r) => {
      const p = resolve(r);
      return { name: basename(p), path: p };
    });
  }

  async browseDirectories(path?: string): Promise<DirectoryEntry[]> {
    if (!path) return this.rootEntries();
    this.guard(path);
    return this.filesystem.browseDirectories(path);
  }

  async browseEntries(
    path?: string,
    opts?: { showHidden?: boolean },
  ): Promise<{ directories: DirectoryEntry[]; files: FileEntry[] }> {
    if (!path) return { directories: this.rootEntries(), files: [] };
    this.guard(path);
    return this.filesystem.browseEntries(path, opts);
  }

  async readFile(file: string, opts?: ReadFileOpts): Promise<ReadFileResult> {
    if (opts?.cwd) {
      // Guard the cwd against allowed roots; traversal within cwd is enforced
      // by LocalFilesystem.readFile via its own isPathWithin(cwd, resolved) check.
      // Do not weaken or remove that inner check — it is the only barrier against
      // `../../outside` style escapes when cwd is valid.
      if (!this.isWithin(opts.cwd)) return { error: 'Path traversal not allowed' };
    } else {
      this.guard(file);
    }
    return this.filesystem.readFile(file, opts);
  }

  async *readLines(absolutePath: string): AsyncIterable<string> {
    this.guard(absolutePath);
    yield* this.filesystem.readLines(absolutePath);
  }

  async writeFile(absolutePath: string, content: string): Promise<WriteFileResult> {
    this.guard(absolutePath);
    return this.filesystem.writeFile(absolutePath, content);
  }

  async create(absolutePath: string, kind: FileKind): Promise<FsMutationResult> {
    this.guard(absolutePath);
    return this.filesystem.create(absolutePath, kind);
  }

  async delete(absolutePath: string): Promise<FsMutationResult> {
    this.guard(absolutePath);
    return this.filesystem.delete(absolutePath);
  }

  async rename(from: string, to: string): Promise<FsMutationResult> {
    return this.guardBoth(from, to, (f, t) => this.filesystem.rename(f, t));
  }

  async copy(from: string, to: string): Promise<FsMutationResult> {
    return this.guardBoth(from, to, (f, t) => this.filesystem.copy(f, t));
  }

  async move(from: string, to: string): Promise<FsMutationResult> {
    return this.guardBoth(from, to, (f, t) => this.filesystem.move(f, t));
  }

  private guardBoth(
    from: string,
    to: string,
    fn: (from: string, to: string) => Promise<FsMutationResult>,
  ): Promise<FsMutationResult> {
    this.guard(from);
    this.guard(to);
    return fn(from, to);
  }

  async listFiles(cwd: string, pattern: string): Promise<FileResult[]> {
    this.guard(cwd);
    return this.filesystem.listFiles(cwd, pattern);
  }

  async exists(path: string): Promise<boolean> {
    this.guard(path);
    return this.filesystem.exists(path);
  }

  async isDirectory(path: string): Promise<boolean> {
    this.guard(path);
    return this.filesystem.isDirectory(path);
  }

  async statKind(path: string): Promise<FileKind | null> {
    this.guard(path);
    return this.filesystem.statKind(path);
  }
}
