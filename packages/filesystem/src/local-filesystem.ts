import { createReadStream } from 'node:fs';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, normalize, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { errMsg, mimeForPath } from '@code-quest/utils';
import Fuse from 'fuse.js';
import { glob } from 'glob';
import { isPathWithin } from './is-path-within.ts';
import type {
  DirectoryEntry,
  FileEntry,
  FileKind,
  FileResult,
  Filesystem,
  FsMutationResult,
  MinimalLogger,
  ReadFileOpts,
  ReadFileResult,
  WriteFileResult,
} from './types.ts';

interface ListCacheEntry {
  files: string[];
  dirs: string[];
  /** Built lazily on first fuzzy query. */
  fuse: Fuse<{ path: string; filename: string; isDirectory: boolean }> | null;
}

const MAX_RESULTS = 20;
const MAX_GLOB_DEPTH = 10;

const GLOB_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/coverage/**',
  '**/logs/**',
];

const BROWSE_IGNORED = new Set(['node_modules', 'dist', 'coverage', '.git']);

const noopLogger: MinimalLogger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};

export class LocalFilesystem implements Filesystem {
  private readonly logger: MinimalLogger;
  private readonly fsImpl?: typeof import('node:fs');

  constructor(logger?: MinimalLogger, fsImpl?: typeof import('node:fs')) {
    this.logger = logger ?? noopLogger;
    this.fsImpl = fsImpl;
  }

  async browseDirectories(path?: string): Promise<DirectoryEntry[]> {
    if (!path) return [];
    const result = await this.readBrowseEntries(path, false);
    return result.directories;
  }

  async browseEntries(
    path?: string,
    opts?: { showHidden?: boolean },
  ): Promise<{ directories: DirectoryEntry[]; files: FileEntry[] }> {
    if (!path) return { directories: [], files: [] };
    return this.readBrowseEntries(path, opts?.showHidden ?? false);
  }

  private async readBrowseEntries(
    path: string,
    showHidden: boolean,
  ): Promise<{ directories: DirectoryEntry[]; files: FileEntry[] }> {
    const validated = resolve(path);

    try {
      const entries = await readdir(validated, { withFileTypes: true });
      const directories: DirectoryEntry[] = [];
      const fileNames: string[] = [];
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        if (!showHidden && entry.name.startsWith('.')) continue;
        if (entry.isDirectory()) {
          if (BROWSE_IGNORED.has(entry.name)) continue;
          directories.push({ name: entry.name, path: join(validated, entry.name) });
        } else if (entry.isFile()) {
          fileNames.push(entry.name);
        }
      }
      const files: FileEntry[] = await Promise.all(
        fileNames.map(async (name) => {
          const filePath = join(validated, name);
          const { size } = await stat(filePath);
          return { name, path: filePath, size };
        }),
      );
      directories.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));
      return { directories, files };
    } catch (err) {
      this.logger.debug({ err }, '[LocalFilesystem] readBrowseEntries failed');
      return { directories: [], files: [] };
    }
  }

  // ── listFiles ──

  async listFiles(cwd: string, pattern: string): Promise<FileResult[]> {
    const files = await this.getAllFiles(cwd);
    const dirs = this.extractDirectories(files);
    const entry: ListCacheEntry = { files, dirs, fuse: null };

    if (!pattern) {
      return this.listRootEntries(entry.files, entry.dirs);
    }
    if (pattern.endsWith('/')) {
      return this.listDirectory(pattern, entry.files, entry.dirs);
    }
    return this.fuzzySearch(pattern.toLowerCase(), entry);
  }

  // ── readLines ──

  async *readLines(absolutePath: string): AsyncIterable<string> {
    const validated = resolve(absolutePath);
    const stream = createReadStream(validated, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) yield line;
    }
  }

  // ── writeFile ──

  async writeFile(absolutePath: string, content: string): Promise<WriteFileResult> {
    const validated = resolve(absolutePath);
    try {
      await mkdir(dirname(validated), { recursive: true });
      await writeFile(validated, content, 'utf-8');
      return { ok: true };
    } catch (err) {
      return { error: errMsg(err) };
    }
  }

  // ── Mutations ──

  private async wrapMutation(fn: () => Promise<void>): Promise<FsMutationResult> {
    try {
      await fn();
      return { ok: true };
    } catch (err) {
      return { error: errMsg(err) };
    }
  }

  async create(absolutePath: string, kind: FileKind): Promise<FsMutationResult> {
    const validated = resolve(absolutePath);
    try {
      if (kind === 'directory') {
        await mkdir(validated);
      } else {
        await writeFile(validated, '', { encoding: 'utf-8', flag: 'wx' });
      }
      return { ok: true };
    } catch (err) {
      if (err instanceof Error && /EEXIST/.test(err.message)) return { error: 'exists' };
      return { error: errMsg(err) };
    }
  }

  async delete(absolutePath: string): Promise<FsMutationResult> {
    const validated = resolve(absolutePath);
    return this.wrapMutation(() => rm(validated, { recursive: true, force: true }));
  }

  async rename(from: string, to: string): Promise<FsMutationResult> {
    const fromV = resolve(from);
    const toV = resolve(to);
    if (await this.exists(toV)) return { error: 'exists' };
    return this.wrapMutation(() => rename(fromV, toV));
  }

  async copy(from: string, to: string): Promise<FsMutationResult> {
    const fromV = resolve(from);
    const toV = resolve(to);
    try {
      await cp(fromV, toV, { recursive: true, errorOnExist: true, force: false });
      return { ok: true };
    } catch (err) {
      if (err instanceof Error && /EEXIST|already exists/.test(err.message)) {
        return { error: 'exists' };
      }
      return { error: errMsg(err) };
    }
  }

  async move(from: string, to: string): Promise<FsMutationResult> {
    return this.rename(from, to);
  }

  // ── readFile ──

  async readFile(file: string, opts?: ReadFileOpts): Promise<ReadFileResult> {
    let absolute: string;
    if (opts?.cwd) {
      const resolvedCwd = resolve(opts.cwd);
      absolute = resolve(resolvedCwd, normalize(file));
      if (!isPathWithin(resolvedCwd, absolute)) {
        return { error: 'Path traversal not allowed' };
      }
    } else {
      absolute = resolve(file);
    }
    const { contentType, encoding } = mimeForPath(absolute);
    try {
      if (opts?.maxBytes !== undefined) {
        const { size } = await stat(absolute);
        if (size > opts.maxBytes) return { tooLarge: true };
      }
      if (encoding === 'base64') {
        const buffer = await readFile(absolute);
        return { content: buffer.toString('base64'), contentType, encoding };
      }
      const content = await readFile(absolute, 'utf-8');
      return { content, contentType, encoding };
    } catch (err) {
      this.logger.debug({ err }, '[LocalFilesystem] readFile failed');
      return { error: `File not found: ${file}` };
    }
  }

  // ── Private helpers ──

  private async getAllFiles(cwd: string): Promise<string[]> {
    return glob('**/*', {
      cwd,
      dot: true,
      ignore: GLOB_IGNORE,
      nodir: true,
      maxDepth: MAX_GLOB_DEPTH,
      ...(this.fsImpl ? { fs: this.fsImpl } : {}),
    });
  }

  private extractDirectories(files: string[]): string[] {
    const dirs = new Set<string>();
    for (const f of files) {
      f.split('/')
        .slice(0, -1)
        .reduce((prefix, segment) => {
          const dir = prefix ? `${prefix}/${segment}` : segment;
          dirs.add(dir);
          return dir;
        }, '');
    }
    return [...dirs].map((d) => `${d}/`);
  }

  private collectEntries(
    dirs: string[],
    files: string[],
    toDirEntry: (d: string) => { key: string; result: FileResult } | null,
    toFileEntry: (f: string) => { key: string; result: FileResult } | null,
  ): FileResult[] {
    const seen = new Set<string>();
    const results: FileResult[] = [];
    for (const d of dirs) {
      const item = toDirEntry(d);
      if (item && !seen.has(item.key)) {
        seen.add(item.key);
        results.push(item.result);
      }
    }
    for (const f of files) {
      const item = toFileEntry(f);
      if (item && !seen.has(item.key)) {
        seen.add(item.key);
        results.push(item.result);
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path)).slice(0, MAX_RESULTS);
  }

  private listRootEntries(files: string[], dirs: string[]): FileResult[] {
    return this.collectEntries(
      dirs,
      files,
      (d) => {
        const root = d.split('/')[0];
        return root
          ? { key: root, result: { path: `${root}/`, name: root, type: 'directory' } }
          : null;
      },
      (f) => (f.includes('/') ? null : { key: f, result: { path: f, name: f, type: 'file' } }),
    );
  }

  private listDirectory(prefix: string, files: string[], dirs: string[]): FileResult[] {
    const prefixLower = prefix.toLowerCase();
    return this.collectEntries(
      dirs,
      files,
      (d) => {
        if (!d.toLowerCase().startsWith(prefixLower)) return null;
        const segment = d.slice(prefix.length).split('/')[0];
        return segment
          ? {
              key: segment,
              result: { path: `${prefix}${segment}/`, name: segment, type: 'directory' },
            }
          : null;
      },
      (f) => {
        if (!f.toLowerCase().startsWith(prefixLower)) return null;
        const rest = f.slice(prefix.length);
        return rest.includes('/')
          ? null
          : { key: rest, result: { path: f, name: basename(f), type: 'file' } };
      },
    );
  }

  private fuzzySearch(pattern: string, entry: ListCacheEntry): FileResult[] {
    if (!entry.fuse) {
      const items = [
        ...entry.files.map((f) => ({ path: f, filename: basename(f), isDirectory: false })),
        ...entry.dirs.map((d) => ({
          path: d,
          filename: basename(d.slice(0, -1)),
          isDirectory: true,
        })),
      ];
      entry.fuse = new Fuse(items, {
        includeScore: true,
        threshold: 0.5,
        keys: [
          { name: 'path', weight: 1 },
          { name: 'filename', weight: 2 },
        ],
      });
    }
    return entry.fuse.search(pattern, { limit: MAX_RESULTS }).map((r) => ({
      path: r.item.path,
      name: r.item.filename,
      type: r.item.isDirectory ? 'directory' : 'file',
    }));
  }

  private async tryStat(path: string): Promise<import('node:fs').Stats | null> {
    const validated = resolve(path);
    try {
      return await stat(validated);
    } catch (e: unknown) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async exists(path: string): Promise<boolean> {
    return (await this.tryStat(path)) !== null;
  }

  async isDirectory(path: string): Promise<boolean> {
    const s = await this.tryStat(path);
    return s?.isDirectory() ?? false;
  }

  async statKind(path: string): Promise<FileKind | null> {
    const s = await this.tryStat(path);
    if (!s) return null;
    if (s.isDirectory()) return 'directory';
    if (s.isFile()) return 'file';
    return null;
  }
}
