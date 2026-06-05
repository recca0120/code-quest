export type DirectoryEntry = { name: string; path: string };
export type FileEntry = { name: string; path: string; size: number };
export type FileResult = { path: string; name: string; type: 'file' | 'directory' };
export type FileKind = 'file' | 'directory';
export type ReadFileResult =
  | { content: string; contentType: string; encoding: 'utf-8' | 'base64' }
  | { tooLarge: true }
  | { error: string };
export type ReadFileOpts = { cwd?: string; maxBytes?: number };
export type WriteFileResult = { ok: true } | { error: string };
export type FsMutationResult = { ok: true } | { error: string };

export class PathOutsideRootsError extends Error {
  readonly path: string;
  constructor(path: string) {
    super('Path outside allowed roots');
    this.name = 'PathOutsideRootsError';
    this.path = path;
  }
}

export interface Filesystem {
  browseDirectories(path?: string): Promise<DirectoryEntry[]>;
  browseEntries(
    path?: string,
    opts?: { showHidden?: boolean },
  ): Promise<{ directories: DirectoryEntry[]; files: FileEntry[] }>;
  readFile(file: string, opts?: ReadFileOpts): Promise<ReadFileResult>;
  readLines(absolutePath: string): AsyncIterable<string>;
  writeFile(absolutePath: string, content: string): Promise<WriteFileResult>;
  create(absolutePath: string, kind: FileKind): Promise<FsMutationResult>;
  delete(absolutePath: string): Promise<FsMutationResult>;
  rename(from: string, to: string): Promise<FsMutationResult>;
  copy(from: string, to: string): Promise<FsMutationResult>;
  move(from: string, to: string): Promise<FsMutationResult>;
  listFiles(cwd: string, pattern: string): Promise<FileResult[]>;
  exists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  statKind(path: string): Promise<FileKind | null>;
}

export interface MinimalLogger {
  debug(obj: object, msg: string): void;
  warn(msg: string): void;
  error(obj: object, msg: string): void;
}

export interface RemoteRpc {
  request<R = unknown>(method: string, params: unknown): Promise<R>;
}
