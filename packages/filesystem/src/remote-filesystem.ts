import {
  fsBrowseDirectoriesResponseSchema,
  fsBrowseEntriesResponseSchema,
  fsExistsResponseSchema,
  fsIsDirectoryResponseSchema,
  fsListResponseSchema,
  fsMutationResultSchema,
  fsReadFileResponseSchema,
  fsStatKindResponseSchema,
  REMOTE_METHODS,
} from '@code-quest/schemas';
import type {
  DirectoryEntry,
  FileEntry,
  FileKind,
  FileResult,
  Filesystem,
  FsMutationResult,
  ReadFileOpts,
  ReadFileResult,
  RemoteRpc,
  WriteFileResult,
} from './types.ts';

export class RemoteFilesystem implements Filesystem {
  private readonly rpc: RemoteRpc;

  constructor(rpc: RemoteRpc) {
    this.rpc = rpc;
  }

  async browseDirectories(path?: string): Promise<DirectoryEntry[]> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.browseDirectories, { path });
    return fsBrowseDirectoriesResponseSchema.parse(raw).entries;
  }

  async browseEntries(
    path?: string,
    opts?: { showHidden?: boolean },
  ): Promise<{ directories: DirectoryEntry[]; files: FileEntry[] }> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.browseEntries, {
      path,
      showHidden: opts?.showHidden,
    });
    return fsBrowseEntriesResponseSchema.parse(raw);
  }

  async *readLines(absolutePath: string): AsyncIterable<string> {
    const result = await this.readFile(absolutePath);
    if ('error' in result || 'tooLarge' in result) return;
    for (const line of result.content.split('\n')) {
      if (line.trim()) yield line;
    }
  }

  async writeFile(absolutePath: string, content: string): Promise<WriteFileResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.writeFile, {
      absolutePath,
      content,
    });
    return fsMutationResultSchema.parse(raw);
  }

  async create(absolutePath: string, kind: FileKind): Promise<FsMutationResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.create, { absolutePath, kind });
    return fsMutationResultSchema.parse(raw);
  }

  async delete(absolutePath: string): Promise<FsMutationResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.delete, { absolutePath });
    return fsMutationResultSchema.parse(raw);
  }

  async rename(from: string, to: string): Promise<FsMutationResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.rename, { from, to });
    return fsMutationResultSchema.parse(raw);
  }

  async copy(from: string, to: string): Promise<FsMutationResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.copy, { from, to });
    return fsMutationResultSchema.parse(raw);
  }

  async move(from: string, to: string): Promise<FsMutationResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.move, { from, to });
    return fsMutationResultSchema.parse(raw);
  }

  async listFiles(cwd: string, pattern: string): Promise<FileResult[]> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.list, { cwd, pattern });
    return fsListResponseSchema.parse(raw).files;
  }

  async readFile(file: string, opts?: ReadFileOpts): Promise<ReadFileResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.read, {
      file,
      cwd: opts?.cwd,
      maxBytes: opts?.maxBytes,
    });
    return fsReadFileResponseSchema.parse(raw);
  }

  async exists(path: string): Promise<boolean> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.exists, { path });
    return fsExistsResponseSchema.parse(raw).exists;
  }

  async isDirectory(path: string): Promise<boolean> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.isDirectory, { path });
    return fsIsDirectoryResponseSchema.parse(raw).isDirectory;
  }

  async statKind(path: string): Promise<FileKind | null> {
    const raw = await this.rpc.request(REMOTE_METHODS.fs.statKind, { path });
    return fsStatKindResponseSchema.parse(raw).kind;
  }
}
