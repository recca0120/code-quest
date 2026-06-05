import type { Filesystem } from '@code-quest/filesystem';
import type { AgentTransport } from '@code-quest/schemas';
import {
  fsBrowseDirectoriesParamsSchema,
  fsBrowseEntriesParamsSchema,
  fsCopyParamsSchema,
  fsCreateParamsSchema,
  fsDeleteParamsSchema,
  fsExistsParamsSchema,
  fsIsDirectoryParamsSchema,
  fsListParamsSchema,
  fsMoveParamsSchema,
  fsReadParamsSchema,
  fsRenameParamsSchema,
  fsStatKindParamsSchema,
  fsWriteFileAbsoluteParamsSchema,
  REMOTE_METHODS,
} from '@code-quest/schemas';
import type { AgentHandler } from '../agent-handler.ts';

export class FsHandler implements AgentHandler {
  private readonly filesystem: Filesystem;

  constructor(filesystem: Filesystem) {
    this.filesystem = filesystem;
  }

  attach(rpc: AgentTransport): void {
    const fs = this.filesystem;

    rpc.onRequest(REMOTE_METHODS.fs.browseDirectories, async (params) => {
      const p = fsBrowseDirectoriesParamsSchema.parse(params);
      const entries = await fs.browseDirectories(p.path);
      return { entries };
    });

    rpc.onRequest(REMOTE_METHODS.fs.browseEntries, async (params) => {
      const p = fsBrowseEntriesParamsSchema.parse(params);
      return fs.browseEntries(p.path, { showHidden: p.showHidden });
    });

    rpc.onRequest(REMOTE_METHODS.fs.writeFile, async (params) => {
      const p = fsWriteFileAbsoluteParamsSchema.parse(params);
      return fs.writeFile(p.absolutePath, p.content);
    });

    rpc.onRequest(REMOTE_METHODS.fs.create, async (params) => {
      const p = fsCreateParamsSchema.parse(params);
      return fs.create(p.absolutePath, p.kind);
    });

    rpc.onRequest(REMOTE_METHODS.fs.delete, async (params) => {
      const p = fsDeleteParamsSchema.parse(params);
      return fs.delete(p.absolutePath);
    });

    rpc.onRequest(REMOTE_METHODS.fs.rename, async (params) => {
      const p = fsRenameParamsSchema.parse(params);
      return fs.rename(p.from, p.to);
    });

    rpc.onRequest(REMOTE_METHODS.fs.copy, async (params) => {
      const p = fsCopyParamsSchema.parse(params);
      return fs.copy(p.from, p.to);
    });

    rpc.onRequest(REMOTE_METHODS.fs.move, async (params) => {
      const p = fsMoveParamsSchema.parse(params);
      return fs.move(p.from, p.to);
    });

    rpc.onRequest(REMOTE_METHODS.fs.list, async (params) => {
      const p = fsListParamsSchema.parse(params);
      const files = await fs.listFiles(p.cwd, p.pattern);
      return { files };
    });

    rpc.onRequest(REMOTE_METHODS.fs.read, async (params) => {
      const p = fsReadParamsSchema.parse(params);
      return fs.readFile(p.file, { cwd: p.cwd, maxBytes: p.maxBytes });
    });

    rpc.onRequest(REMOTE_METHODS.fs.exists, async (params) => {
      const p = fsExistsParamsSchema.parse(params);
      const exists = await fs.exists(p.path);
      return { exists };
    });

    rpc.onRequest(REMOTE_METHODS.fs.isDirectory, async (params) => {
      const p = fsIsDirectoryParamsSchema.parse(params);
      const isDirectory = await fs.isDirectory(p.path);
      return { isDirectory };
    });

    rpc.onRequest(REMOTE_METHODS.fs.statKind, async (params) => {
      const p = fsStatKindParamsSchema.parse(params);
      const kind = await fs.statKind(p.path);
      return { kind };
    });
  }
}
