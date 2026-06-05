import { useEffect } from 'react';

interface EventSocket {
  // biome-ignore lint/suspicious/noExplicitAny: bypass socket.io event-name contravariance
  on(event: any, fn: (...args: unknown[]) => void): unknown;
  // biome-ignore lint/suspicious/noExplicitAny: bypass socket.io event-name contravariance
  off(event: any, fn: (...args: unknown[]) => void): unknown;
}

interface DirtyStore<R> {
  setFetch(fn: (cwd: string) => Promise<R>): void;
  set(cwd: string, value: R): void;
  refetchIfSubscribed(cwd: string): Promise<void>;
}

export function useDirtyQueryCache<S extends EventSocket, R>(
  socket: S | null,
  store: DirtyStore<R>,
  fetchFactory: (socket: S | null) => (cwd: string) => Promise<R>,
  dirtyEvent: string,
  extractCwd: (payload: unknown) => string | null,
  extractSnapshot: (payload: unknown) => R | null,
): void {
  useEffect(() => {
    store.setFetch(fetchFactory(socket));
  }, [socket, store, fetchFactory]);

  useEffect(() => {
    if (!socket) return;
    const onDirty = (payload: unknown) => {
      const cwd = extractCwd(payload);
      if (!cwd) return;
      const snapshot = extractSnapshot(payload);
      if (snapshot) {
        store.set(cwd, snapshot);
      } else {
        void store.refetchIfSubscribed(cwd);
      }
    };
    socket.on(dirtyEvent, onDirty);
    return () => {
      socket.off(dirtyEvent, onDirty);
    };
  }, [socket, store, dirtyEvent, extractCwd, extractSnapshot]);
}
