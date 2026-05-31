import { createFakeServer, createTestContainer, TYPES } from '@code-quest/server/test';
import type { FakeFileWatcher } from '@code-quest/test-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeSummoner } from '@/test/fake-summoner';
import { FsProvider, useFsActions } from '../FsContext.tsx';
import { SocketProvider } from '../SocketContext.tsx';

function makeEnv() {
  const container = createTestContainer();
  const server = createFakeServer(container);
  const summoner = new FakeSummoner(server);
  summoner.filesystem().setRoots(['/repo']);
  const watch = container.get<FakeFileWatcher>(TYPES.FileWatcher);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SocketProvider socket={summoner.socket}>
        <FsProvider>{children}</FsProvider>
      </SocketProvider>
    );
  }
  return { Wrapper, summoner, watch };
}

describe('FsContext pub/sub', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('first subscriber starts server-side watch', async () => {
    const { Wrapper, watch } = makeEnv();

    const { result } = renderHook(() => useFsActions(), { wrapper: Wrapper });
    expect(watch.isWatching('/repo')).toBe(false);

    const off = result.current.subscribeFsDirty('/repo', vi.fn());
    await waitFor(() => expect(watch.isWatching('/repo')).toBe(true));

    off();
  });

  it('second subscriber also receives initial snapshot', async () => {
    const { Wrapper } = makeEnv();

    const { result } = renderHook(() => useFsActions(), { wrapper: Wrapper });
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const off1 = result.current.subscribeFsDirty('/repo', cb1);
    await waitFor(() => expect(cb1).toHaveBeenCalled());

    const off2 = result.current.subscribeFsDirty('/repo', cb2);
    await waitFor(() => expect(cb2).toHaveBeenCalled());

    off1();
    off2();
  });

  it('all subscribers releasing stops server-side watch', async () => {
    const { Wrapper, watch } = makeEnv();

    const { result } = renderHook(() => useFsActions(), { wrapper: Wrapper });
    const off1 = result.current.subscribeFsDirty('/repo', vi.fn());
    const off2 = result.current.subscribeFsDirty('/repo', vi.fn());

    await waitFor(() => expect(watch.isWatching('/repo')).toBe(true));

    off1();
    await waitFor(() => expect(watch.isWatching('/repo')).toBe(true));

    off2();
    await waitFor(() => expect(watch.isWatching('/repo')).toBe(false));
  });

  it('unsubscribe is idempotent (second call no-op)', async () => {
    const { Wrapper, watch } = makeEnv();

    const { result } = renderHook(() => useFsActions(), { wrapper: Wrapper });
    const off = result.current.subscribeFsDirty('/repo', vi.fn());
    await waitFor(() => expect(watch.isWatching('/repo')).toBe(true));

    off();
    off();
    await waitFor(() => expect(watch.isWatching('/repo')).toBe(false));
  });

  it('file change triggers root-refresh signal on subscriber', async () => {
    const { Wrapper, watch } = makeEnv();

    const { result } = renderHook(() => useFsActions(), { wrapper: Wrapper });
    const cb = vi.fn<(paths: string[]) => void>();
    const off = result.current.subscribeFsDirty('/repo', cb);

    // wait for initial snapshot
    await waitFor(() => expect(cb).toHaveBeenCalled());
    cb.mockClear();

    await act(async () => {
      watch.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
    });

    await waitFor(() => expect(cb).toHaveBeenCalled());
    // snapshot-based updates always signal root refresh with ['']
    expect(cb.mock.calls[0]![0]).toEqual(['']);

    off();
  });

  it('different cwds isolated — only matching subscriber fires on change', async () => {
    const { Wrapper, watch, summoner } = makeEnv();
    summoner.filesystem().setRoots(['/repo', '/other']);

    const { result } = renderHook(() => useFsActions(), { wrapper: Wrapper });
    const cbRepo = vi.fn();
    const cbOther = vi.fn();
    const offA = result.current.subscribeFsDirty('/repo', cbRepo);
    const offB = result.current.subscribeFsDirty('/other', cbOther);

    // wait for initial snapshots
    await waitFor(() => expect(cbRepo).toHaveBeenCalled());
    await waitFor(() => expect(cbOther).toHaveBeenCalled());
    cbRepo.mockClear();
    cbOther.mockClear();

    await act(async () => {
      watch.simulate('/repo', { type: 'change', path: 'a.ts' });
    });

    await waitFor(() => expect(cbRepo).toHaveBeenCalledTimes(1));
    expect(cbOther).not.toHaveBeenCalled();

    offA();
    offB();
  });
});
