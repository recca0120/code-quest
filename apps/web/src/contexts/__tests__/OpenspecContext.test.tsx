import { createFakeServer } from '@code-quest/server/test';
import { FakeOpenspec } from '@code-quest/summoner/test';
import { render, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeSummoner } from '@/test/fake-summoner';
import { OpenspecProvider, useOpenspecActions, useOpenspecList } from '../OpenspecContext.tsx';
import { SocketProvider } from '../SocketContext.tsx';

function makeEnv() {
  const server = createFakeServer();
  const priming = new FakeSummoner(server);
  function Wrapper({ children }: { children: ReactNode }) {
    const ref = useRef<FakeSummoner | null>(null);
    if (!ref.current) ref.current = new FakeSummoner(server);
    return (
      <SocketProvider socket={ref.current.socket}>
        <OpenspecProvider>{children}</OpenspecProvider>
      </SocketProvider>
    );
  }
  return { Wrapper, priming };
}

describe('OpenspecContext (external store via useSyncExternalStore)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('two consumers for the same cwd produce exactly one openspec:list RPC', async () => {
    const { Wrapper, priming } = makeEnv();
    priming.filesystem().setRoots(['/repo']);
    const listSpy = vi.spyOn(FakeOpenspec.prototype, 'list');

    function Consumer() {
      useOpenspecList('/repo');
      return null;
    }
    render(
      <Wrapper>
        <Consumer />
        <Consumer />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalled();
    });
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('returns the fetched list after first mount', async () => {
    const { Wrapper, priming } = makeEnv();
    priming.filesystem().setRoots(['/repo']);

    const { result } = renderHook(() => useOpenspecList('/repo'), { wrapper: Wrapper });
    expect(result.current).toBeUndefined();
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });

  it('switching cwd back to a cached cwd is synchronous (zero flicker)', async () => {
    const { Wrapper, priming } = makeEnv();
    priming.filesystem().setRoots(['/a', '/b']);

    const { result, rerender } = renderHook(({ cwd }) => useOpenspecList(cwd), {
      wrapper: Wrapper,
      initialProps: { cwd: '/a' },
    });
    await waitFor(() => expect(result.current).toBeDefined());
    const aValue = result.current;

    rerender({ cwd: '/b' });
    await waitFor(() => expect(result.current).toBeDefined());

    rerender({ cwd: '/a' });
    expect(result.current).toBe(aValue);
  });

  it('openspec:dirty for un-subscribed cwd does not fetch', async () => {
    const { Wrapper, priming } = makeEnv();
    priming.filesystem().setRoots(['/repo']);
    const listSpy = vi.spyOn(FakeOpenspec.prototype, 'list');

    renderHook(() => useOpenspecActions(), { wrapper: Wrapper });
    expect(listSpy).not.toHaveBeenCalled();
  });

  describe('write actions', () => {
    it('changeNew round-trips to FakeOpenspec and returns {ok:true}', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      const { result } = renderHook(() => useOpenspecActions(), { wrapper: Wrapper });
      const response = await result.current.changeNew('/repo', 'add-foo');
      expect(response).toEqual({ ok: true });
      expect(priming.openspec()?.changeNewCalls).toEqual([{ cwd: '/repo', name: 'add-foo' }]);
    });

    it('changeNew surfaces server error', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      priming.openspec()?.setChangeNewError('exists');
      const { result } = renderHook(() => useOpenspecActions(), { wrapper: Wrapper });
      expect(await result.current.changeNew('/repo', 'dup')).toEqual({ error: 'exists' });
    });

    it('archive round-trips with skipSpecs flag forwarded', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      const { result } = renderHook(() => useOpenspecActions(), { wrapper: Wrapper });
      expect(await result.current.archive('/repo', 'done-change')).toEqual({ ok: true });
      expect(await result.current.archive('/repo', 'done-change', { skipSpecs: true })).toEqual({
        ok: true,
      });
      expect(priming.openspec()?.archiveCalls).toEqual([
        { cwd: '/repo', name: 'done-change', skipSpecs: undefined },
        { cwd: '/repo', name: 'done-change', skipSpecs: true },
      ]);
    });

    it('archive surfaces server error', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      priming.openspec()?.setArchiveError('open tasks remain');
      const { result } = renderHook(() => useOpenspecActions(), { wrapper: Wrapper });
      expect(await result.current.archive('/repo', 'incomplete')).toEqual({
        error: 'open tasks remain',
      });
    });

    it('toggleTask round-trips with lineIndex', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      const { result } = renderHook(() => useOpenspecActions(), { wrapper: Wrapper });
      const response = await result.current.toggleTask('/repo', 'add-foo', 3);
      expect(response).toEqual({ ok: true, checked: true });
      expect(priming.openspec()?.toggleTaskCalls).toEqual([
        { cwd: '/repo', name: 'add-foo', lineIndex: 3 },
      ]);
    });
  });
});
