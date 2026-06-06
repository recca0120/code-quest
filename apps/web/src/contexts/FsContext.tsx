import type { FileResult, FsMutationResult } from '@code-quest/filesystem';
import {
  EVENTS,
  type FsDirectory,
  type FsFile,
  filesDirtyEventSchema,
  fsBrowseResponseSchema,
  fsMutationResultSchema,
} from '@code-quest/schemas';
import { TopicEmitter } from '@code-quest/utils';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from 'react';
import { rpc } from '../socket/rpc.ts';
import { useSocket } from './SocketContext.tsx';

type FsBrowseEntries = { directories: FsDirectory[]; files: FsFile[] } | { error: string };

interface FsActions {
  browse: (path?: string, opts?: { showHidden?: boolean }) => Promise<FsBrowseEntries>;
  /** Subscribe to `files:dirty` events for `cwd`. The first subscriber per
   *  cwd emits `fs:watch` to the server (refcounted); the last release
   *  emits `fs:unwatch`. Returned unsubscribe is idempotent.
   *
   *  `onDirty` receives the cwd-relative paths and an optional snapshot.
   *  When snapshot is present and paths is `['']`, the full file list is
   *  already available — consumers should prefer it over a follow-up RPC. */
  subscribeFsDirty: (
    cwd: string,
    onDirty: (paths: string[], snapshot?: FileResult[]) => void,
  ) => () => void;
  // ── Mutations ──
  create: (path: string, kind: 'file' | 'directory') => Promise<FsMutationResult>;
  delete: (path: string) => Promise<FsMutationResult>;
  rename: (from: string, to: string) => Promise<FsMutationResult>;
  copy: (from: string, to: string) => Promise<FsMutationResult>;
  move: (from: string, to: string) => Promise<FsMutationResult>;
}

const FsActionsContext = createContext<FsActions | null>(null);

export function useFsActions(): FsActions {
  const ctx = useContext(FsActionsContext);
  if (!ctx) throw new Error('useFsActions must be used within FsProvider');
  return ctx;
}

export function FsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { socket } = useSocket();
  const emitterRef = useRef<TopicEmitter<string, { paths: string[]; snapshot?: FileResult[] }>>(
    new TopicEmitter(),
  );
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (!socket) return;
    const onDirty = (payload: unknown) => {
      const parsed = filesDirtyEventSchema.safeParse(payload);
      if (!parsed.success) return;
      const { cwd, paths, snapshot } = parsed.data;
      if (paths.length > 0) {
        emitterRef.current.publish(cwd, { paths });
      } else if (snapshot !== undefined) {
        // snapshot is unknown[] from Zod schema — server guarantees FileResult shape
        emitterRef.current.publish(cwd, { paths: [''], snapshot: snapshot as FileResult[] });
      }
    };
    socket.on(EVENTS.fs.dirty, onDirty);
    return () => {
      socket.off(EVENTS.fs.dirty, onDirty);
    };
  }, [socket]);

  const actions = useMemo<FsActions>(() => {
    async function mutate(event: string, payload: unknown): Promise<FsMutationResult> {
      const response = await rpc(socket, event as Parameters<typeof rpc>[1], payload as never);
      const parsed = fsMutationResultSchema.safeParse(response);
      return parsed.success ? parsed.data : { error: 'Invalid response' };
    }

    return {
      async browse(path, opts) {
        const payload: { path?: string; showHidden: boolean } = {
          showHidden: opts?.showHidden ?? false,
        };
        if (path) payload.path = path;
        const response = await rpc(socket, EVENTS.fs.browse, payload);
        const parsed = fsBrowseResponseSchema.safeParse(response);
        if (!parsed.success) return { directories: [], files: [] };
        if ('error' in parsed.data) return { error: parsed.data.error };
        return { directories: parsed.data.directories, files: parsed.data.files };
      },
      create: (path, kind) => mutate(EVENTS.fs.create, { path, kind }),
      delete: (path) => mutate(EVENTS.fs.delete, { path }),
      rename: (from, to) => mutate(EVENTS.fs.rename, { from, to }),
      copy: (from, to) => mutate(EVENTS.fs.copy, { from, to }),
      move: (from, to) => mutate(EVENTS.fs.move, { from, to }),
      subscribeFsDirty(cwd, onDirty) {
        const subscriberId = `sub-${nextIdRef.current++}`;
        const off = emitterRef.current.subscribe(cwd, subscriberId, ({ paths, snapshot }) =>
          onDirty(paths, snapshot),
        );
        socket.emit(EVENTS.fs.watch, { cwd, subscriberId });
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          off();
          socket.emit(EVENTS.fs.unwatch, { subscriberId });
        };
      },
    };
  }, [socket]);

  return <FsActionsContext.Provider value={actions}>{children}</FsActionsContext.Provider>;
}

export function useFsBrowse(): {
  browse: (path?: string) => Promise<FsDirectory[]>;
  browseEntries: (path?: string, opts?: { showHidden?: boolean }) => Promise<FsBrowseEntries>;
} {
  const { browse: browseEntries } = useFsActions();

  async function browse(path?: string): Promise<FsDirectory[]> {
    const result = await browseEntries(path);
    if ('error' in result) return [];
    return result.directories;
  }

  return { browse, browseEntries };
}
