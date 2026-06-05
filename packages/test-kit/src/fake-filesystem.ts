import { basename, dirname, join } from 'node:path';
import type {
  DirectoryEntry,
  FileEntry,
  FileResult,
  Filesystem,
  FsMutationResult,
  ReadFileOpts,
  ReadFileResult,
  WriteFileResult,
} from '@code-quest/filesystem';
import { isPathWithin } from '@code-quest/filesystem';
import { mimeForPath } from '@code-quest/utils';

export type FileTree = { [name: string]: string | FileTree };

export class FakeFilesystem implements Filesystem {
  private roots: string[] = [];
  private dirs = new Map<string, string[]>();
  private files = new Map<string, string>();
  private failWrites = new Set<string>();

  // ── Setup API ──

  setRoots(roots: string[]): void {
    this.roots = roots;
  }

  getRoots(): string[] {
    return this.roots;
  }

  addDirectory(parent: string, children: string[]): void {
    this.dirs.set(parent, children);
  }

  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  failNextWrite(path: string): void {
    this.failWrites.add(path);
  }

  reset(): void {
    this.roots = [];
    this.dirs.clear();
    this.files.clear();
    this.failWrites.clear();
  }

  fromTree(root: string, tree: FileTree): void {
    if (!this.roots.includes(root)) {
      this.roots = [...this.roots, root];
    }
    this.populateTree(root, tree);
  }

  private populateTree(parent: string, tree: FileTree): void {
    const dirChildren: string[] = [];
    for (const [name, value] of Object.entries(tree)) {
      const childPath = join(parent, name);
      if (typeof value === 'string') {
        this.files.set(childPath, value);
      } else {
        dirChildren.push(name);
        this.populateTree(childPath, value);
      }
    }
    if (dirChildren.length > 0) {
      this.addDirectory(parent, dirChildren);
    }
  }

  // ── Filesystem interface ──

  async browseDirectories(path?: string): Promise<DirectoryEntry[]> {
    if (!path) {
      return this.roots.map((r) => ({ name: basename(r), path: r }));
    }

    const children = this.dirs.get(path);
    if (!children) return [];

    return children
      .slice()
      .sort()
      .map((name) => ({ name, path: join(path, name) }));
  }

  private directChildFiles(dir: string): string[] {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    const result: string[] = [];
    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const rel = filePath.slice(prefix.length);
      if (!rel.includes('/')) result.push(filePath);
    }
    return result;
  }

  async browseEntries(
    path?: string,
  ): Promise<{ directories: DirectoryEntry[]; files: FileEntry[] }> {
    const directories = await this.browseDirectories(path);
    if (!path) return { directories, files: [] };
    const files: FileEntry[] = this.directChildFiles(path)
      .map((p) => ({
        name: basename(p),
        path: p,
        size: Buffer.byteLength(this.files.get(p) ?? ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { directories, files };
  }

  async listFiles(cwd: string, pattern: string): Promise<FileResult[]> {
    const results: FileResult[] = [];

    const childDirs = this.dirs.get(cwd);
    if (childDirs) {
      for (const name of childDirs) {
        results.push({ path: `${name}/`, name, type: 'directory' });
      }
    }

    for (const filePath of this.directChildFiles(cwd)) {
      const name = basename(filePath);
      const rel = filePath.slice(cwd.endsWith('/') ? cwd.length : cwd.length + 1);
      results.push({ path: rel, name, type: 'file' });
    }

    if (pattern) {
      const lower = pattern.toLowerCase();
      return results.filter(
        (r) => r.name.toLowerCase().includes(lower) || r.path.toLowerCase().includes(lower),
      );
    }

    return results;
  }

  async *readLines(absolutePath: string): AsyncIterable<string> {
    const content = this.files.get(absolutePath);
    if (content === undefined) throw new Error(`File not found: ${absolutePath}`);
    for (const line of content.split('\n')) {
      if (line.trim()) yield line;
    }
  }

  async writeFile(absolutePath: string, content: string): Promise<WriteFileResult> {
    if (this.failWrites.has(absolutePath)) {
      this.failWrites.delete(absolutePath);
      return { error: `Write failed: ${absolutePath}` };
    }
    this.files.set(absolutePath, content);
    return { ok: true };
  }

  async readFile(file: string, opts?: ReadFileOpts): Promise<ReadFileResult> {
    const cwd = opts?.cwd;
    const absolute = cwd ? join(cwd, file) : file;
    if (cwd && !isPathWithin(cwd, absolute)) {
      return { error: 'Path traversal not allowed' };
    }
    const content = this.files.get(absolute);
    if (content === undefined) {
      return { error: `File not found: ${file}` };
    }
    if (opts?.maxBytes !== undefined && Buffer.byteLength(content) > opts.maxBytes) {
      return { tooLarge: true };
    }
    const { contentType, encoding } = mimeForPath(absolute);
    const encoded = encoding === 'base64' ? Buffer.from(content).toString('base64') : content;
    return { content: encoded, contentType, encoding };
  }

  async exists(path: string): Promise<boolean> {
    return (await this.statKind(path)) !== null;
  }

  async isDirectory(path: string): Promise<boolean> {
    return (await this.statKind(path)) === 'directory';
  }

  async statKind(path: string): Promise<'file' | 'directory' | null> {
    if (this.files.has(path)) return 'file';
    if (this.dirs.has(path)) return 'directory';
    if (this.roots.includes(path)) return 'directory';
    for (const [parent, children] of this.dirs) {
      for (const child of children) {
        if (join(parent, child) === path) return 'directory';
      }
    }
    return null;
  }

  // ── Mutations ──

  async create(absolutePath: string, kind: 'file' | 'directory'): Promise<FsMutationResult> {
    if (await this.exists(absolutePath)) return { error: 'exists' };
    if (kind === 'directory') {
      this.dirs.set(absolutePath, []);
      this.linkChildToParent(absolutePath);
    } else {
      this.files.set(absolutePath, '');
    }
    return { ok: true };
  }

  async delete(absolutePath: string): Promise<FsMutationResult> {
    this.files.delete(absolutePath);
    this.dirs.delete(absolutePath);
    const prefix = `${absolutePath}/`;
    for (const k of [...this.files.keys()]) if (k.startsWith(prefix)) this.files.delete(k);
    for (const k of [...this.dirs.keys()]) if (k.startsWith(prefix)) this.dirs.delete(k);
    this.unlinkChildFromParent(absolutePath);
    return { ok: true };
  }

  async rename(from: string, to: string): Promise<FsMutationResult> {
    if (await this.exists(to)) return { error: 'exists' };
    if (this.files.has(from)) {
      this.files.set(to, this.files.get(from) ?? '');
      this.files.delete(from);
    } else if (this.dirs.has(from)) {
      const prefixOld = `${from}/`;
      const prefixNew = `${to}/`;
      this.dirs.set(to, this.dirs.get(from) ?? []);
      this.dirs.delete(from);
      for (const k of [...this.dirs.keys()]) {
        if (k.startsWith(prefixOld)) {
          this.dirs.set(prefixNew + k.slice(prefixOld.length), this.dirs.get(k) ?? []);
          this.dirs.delete(k);
        }
      }
      for (const k of [...this.files.keys()]) {
        if (k.startsWith(prefixOld)) {
          this.files.set(prefixNew + k.slice(prefixOld.length), this.files.get(k) ?? '');
          this.files.delete(k);
        }
      }
    } else {
      return { error: 'source not found' };
    }
    this.unlinkChildFromParent(from);
    this.linkChildToParent(to);
    return { ok: true };
  }

  async copy(from: string, to: string): Promise<FsMutationResult> {
    if (await this.exists(to)) return { error: 'exists' };
    if (this.files.has(from)) {
      this.files.set(to, this.files.get(from) ?? '');
      this.linkChildToParent(to);
      return { ok: true };
    }
    if (this.dirs.has(from)) {
      const prefixOld = `${from}/`;
      const prefixNew = `${to}/`;
      this.dirs.set(to, [...(this.dirs.get(from) ?? [])]);
      this.linkChildToParent(to);
      for (const [k, v] of this.dirs.entries()) {
        if (k.startsWith(prefixOld)) {
          this.dirs.set(prefixNew + k.slice(prefixOld.length), [...v]);
        }
      }
      for (const [k, v] of this.files.entries()) {
        if (k.startsWith(prefixOld)) {
          this.files.set(prefixNew + k.slice(prefixOld.length), v);
        }
      }
      return { ok: true };
    }
    return { error: 'source not found' };
  }

  async move(from: string, to: string): Promise<FsMutationResult> {
    return this.rename(from, to);
  }

  private linkChildToParent(absolutePath: string): void {
    const parent = dirname(absolutePath);
    const name = basename(absolutePath);
    const siblings = this.dirs.get(parent);
    if (siblings && !siblings.includes(name)) {
      this.dirs.set(parent, [...siblings, name].sort());
    }
  }

  private unlinkChildFromParent(absolutePath: string): void {
    const parent = dirname(absolutePath);
    const name = basename(absolutePath);
    const siblings = this.dirs.get(parent);
    if (siblings) {
      this.dirs.set(
        parent,
        siblings.filter((n) => n !== name),
      );
    }
  }
}
