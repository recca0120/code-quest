import type { SocketCallback, TypedSocket } from '@code-quest/schemas';
import {
  EVENTS,
  fsBrowsePayloadSchema,
  fsCopyPayloadSchema,
  fsCreatePayloadSchema,
  fsDeletePayloadSchema,
  fsMovePayloadSchema,
  fsReadPayloadSchema,
  fsRenamePayloadSchema,
  fsSearchPayloadSchema,
  fsUnwatchPayloadSchema,
  fsWatchPayloadSchema,
} from '@code-quest/schemas';
import { errMsg } from '@code-quest/utils';
import type { ZodType } from 'zod';
import { logger } from '../../logger.ts';
import type { HandlerContext } from '../../types.ts';
import { subscribeSnapshotForSocket } from '../snapshot-subscriber.ts';
import { ok } from '../utils/rpc.ts';

function createFsHandler<T>(
  schema: ZodType<T>,
  fn: (parsed: T) => Promise<Record<string, unknown>>,
  errorLabel: string,
  errorFallback?: Record<string, unknown>,
) {
  return async function handler(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      callback?.(await fn(schema.parse(payload)));
    } catch (err) {
      logger.warn({ err }, `${errorLabel} failed`);
      callback?.(errorFallback ?? { error: errMsg(err) });
    }
  };
}

export function create({
  emitter,
  filesystemService: fs,
  broadcaster,
}: Pick<HandlerContext, 'emitter' | 'filesystemService' | 'broadcaster'>): void {
  const subsBySocket = new Map<string, Map<string, { cwd: string; off: () => void }>>();

  const handleBrowse = createFsHandler(
    fsBrowsePayloadSchema,
    async ({ path, showHidden }) => fs.browseEntries(path, { showHidden }),
    'fs:browse',
  );

  const handleRead = createFsHandler(
    fsReadPayloadSchema,
    async ({ file, cwd, maxBytes }) => fs.readFile(file, { cwd, maxBytes }),
    'fs:read',
    { error: 'Read failed' },
  );

  const handleSearch = createFsHandler(
    fsSearchPayloadSchema,
    async ({ cwd, pattern }) => ok({ files: await fs.listFiles(cwd, pattern) }),
    'fs:search',
    ok({ files: [] }),
  );

  const handleCreate = createFsHandler(
    fsCreatePayloadSchema,
    async ({ path, kind }) => fs.create(path, kind),
    'fs:create',
    { error: 'Create failed' },
  );

  const handleDelete = createFsHandler(
    fsDeletePayloadSchema,
    async ({ path }) => fs.delete(path),
    'fs:delete',
    { error: 'Delete failed' },
  );

  const handleRename = createFsHandler(
    fsRenamePayloadSchema,
    async ({ from, to }) => fs.rename(from, to),
    'fs:rename',
    { error: 'Rename failed' },
  );

  const handleCopy = createFsHandler(
    fsCopyPayloadSchema,
    async ({ from, to }) => fs.copy(from, to),
    'fs:copy',
    { error: 'Copy failed' },
  );

  const handleMove = createFsHandler(
    fsMovePayloadSchema,
    async ({ from, to }) => fs.move(from, to),
    'fs:move',
    { error: 'Move failed' },
  );

  function handleWatch(
    _ch: unknown,
    payload: unknown,
    socket?: TypedSocket,
    callback?: SocketCallback,
  ): void {
    if (!socket) {
      callback?.({});
      return;
    }
    try {
      const { cwd, subscriberId } = fsWatchPayloadSchema.parse(payload);
      let perSub = subsBySocket.get(socket.id);
      if (!perSub) {
        perSub = new Map();
        subsBySocket.set(socket.id, perSub);
        socket.on('disconnect', () => {
          const m = subsBySocket.get(socket.id);
          if (!m) return;
          for (const { off } of m.values()) {
            off();
          }
          subsBySocket.delete(socket.id);
        });
      }
      const existing = perSub.get(subscriberId);
      if (existing) {
        existing.off();
      }
      perSub.set(subscriberId, {
        cwd,
        off: subscribeSnapshotForSocket(socket, subscriberId, cwd, broadcaster),
      });
      callback?.({});
    } catch (err) {
      logger.warn({ err }, 'fs:watch failed');
      callback?.({});
    }
  }

  function handleUnwatch(
    _ch: unknown,
    payload: unknown,
    socket?: TypedSocket,
    callback?: SocketCallback,
  ): void {
    if (!socket) {
      callback?.({});
      return;
    }
    try {
      const { subscriberId } = fsUnwatchPayloadSchema.parse(payload);
      const perSub = subsBySocket.get(socket.id);
      const entry = perSub?.get(subscriberId);
      if (entry) {
        entry.off();
        perSub?.delete(subscriberId);
      }
      callback?.({});
    } catch (err) {
      logger.warn({ err }, 'fs:unwatch failed');
      callback?.({});
    }
  }

  emitter.on(EVENTS.fs.browse, handleBrowse);
  emitter.on(EVENTS.fs.read, handleRead);
  emitter.on(EVENTS.fs.search, handleSearch);
  emitter.on(EVENTS.fs.watch, handleWatch);
  emitter.on(EVENTS.fs.create, handleCreate);
  emitter.on(EVENTS.fs.delete, handleDelete);
  emitter.on(EVENTS.fs.rename, handleRename);
  emitter.on(EVENTS.fs.copy, handleCopy);
  emitter.on(EVENTS.fs.move, handleMove);
  emitter.on(EVENTS.fs.unwatch, handleUnwatch);
}
