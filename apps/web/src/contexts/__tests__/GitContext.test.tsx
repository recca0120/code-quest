import type { WorktreeInfo } from '@code-quest/git';
import { createFakeServer } from '@code-quest/server/test';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FakeSummoner } from '@/test/fake-summoner';
import { GitProvider, useGitActions, useGitState, useGitStatus } from '../GitContext.tsx';
import { SocketProvider } from '../SocketContext.tsx';

function useWorktree() {
  return { ...useGitState(), ...useGitActions() };
}

/**
 * Minimal Socket+Worktree wrapper (intentionally *not* the full provider
 * stack — this file exercises the WorktreeContext contract in isolation).
 *
 * `priming` is a second FakeSummoner sharing the same server, used for
 * out-of-band state seeding and for driving real broadcasts through the
 * server that the hook-under-test's socket should pick up.
 */
function makeEnv() {
  const server = createFakeServer();
  const priming = new FakeSummoner(server);
  function Wrapper({ children }: { children: ReactNode }) {
    const ref = useRef<FakeSummoner | null>(null);
    if (!ref.current) ref.current = new FakeSummoner(server);
    return (
      <SocketProvider socket={ref.current.socket}>
        <GitProvider>{children}</GitProvider>
      </SocketProvider>
    );
  }
  return { Wrapper, priming };
}

describe('WorktreeContext', () => {
  it('useGitState throws when used outside provider', () => {
    expect(() => renderHook(() => useGitState())).toThrow(
      /useGitState must be used within GitProvider/,
    );
  });

  it('state exposes only worktree domain data (listing) — gitStatus is pub/sub, not state', () => {
    const { Wrapper } = makeEnv();
    const { result } = renderHook(() => useGitState(), { wrapper: Wrapper });
    expect(Object.keys(result.current).sort()).toEqual(['listing']);
  });

  it('useWorktree returns an actions object with create/list/removeWorktree', () => {
    const { Wrapper } = makeEnv();
    const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });
    expect(typeof result.current.create).toBe('function');
    expect(typeof result.current.list).toBe('function');
    expect(typeof result.current.removeWorktree).toBe('function');
  });

  it('list() returns worktrees from the server and caches by cwd', async () => {
    const { Wrapper, priming } = makeEnv();
    priming.git()!.setProjectRoot('/repo');
    priming.git()!.addWorktree({
      name: 'seeded',
      path: '/repo/.claude/worktrees/seeded',
      branch: 'worktree-seeded',
    });
    const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.list('/repo');
    });
    expect(
      (result.current.listing['/repo'] as WorktreeInfo[] | undefined)?.some(
        (w) => w.name === 'seeded',
      ),
    ).toBe(true);
  });

  it('remove() invalidates cached listing entry', async () => {
    const { Wrapper, priming } = makeEnv();
    priming.git()!.setProjectRoot('/repo');
    priming.git()!.addWorktree({
      name: 'doomed',
      path: '/repo/.claude/worktrees/doomed',
      branch: 'worktree-doomed',
    });
    const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.list('/repo');
    });
    expect(
      (result.current.listing['/repo'] as WorktreeInfo[] | undefined)?.some(
        (w) => w.name === 'doomed',
      ),
    ).toBe(true);

    let removeResult: { ok: true } | { error: string } = { error: 'not yet' };
    await act(async () => {
      removeResult = await result.current.removeWorktree('/repo', 'doomed', { force: true });
    });
    expect(removeResult).toEqual({ ok: true });
    expect(
      (result.current.listing['/repo'] as WorktreeInfo[] | undefined)?.some(
        (w) => w.name === 'doomed',
      ),
    ).toBe(false);
  });

  it('removeWorktree without force forwards force:false; error returns unchanged', async () => {
    const { Wrapper, priming } = makeEnv();
    priming.git()!.setProjectRoot('/repo');
    priming.git()!.addWorktree({ name: 'x', path: '/repo/.claude/worktrees/x' });
    priming.git()!.setArchiveDirty(true);
    const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.list('/repo');
    });
    let res: { ok: true } | { error: string } = { error: 'not yet' };
    await act(async () => {
      res = await result.current.removeWorktree('/repo', 'x');
    });
    expect(res).toEqual({ error: 'dirty' });
    // listing unchanged on error
    expect(
      (result.current.listing['/repo'] as WorktreeInfo[] | undefined)?.some((w) => w.name === 'x'),
    ).toBe(true);
  });

  it('GitActions does not expose `archive` or `remove` aliases', () => {
    const { Wrapper } = makeEnv();
    const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });
    expect('archive' in result.current).toBe(false);
    expect('remove' in result.current).toBe(false);
  });

  describe('broadcast subscriptions (Phase 4)', () => {
    it('worktree:added broadcast patches cache when project has been fetched', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.git()!.setProjectRoot('/repo');
      const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });
      // Prime cache by fetching
      await act(async () => {
        await result.current.list('/repo');
      });
      expect(result.current.listing['/repo']).toEqual([]);

      // Simulate another tab creating a worktree — real server action →
      // real broadcastAll reaches our provider's socket.
      await act(async () => {
        await priming.claude().initialize({ launch: { cwd: '/repo' } });
        await priming.claude().send('git:worktree:add', {
          cwd: '/repo',
          name: 'from-other-tab',
        });
      });

      expect(
        (result.current.listing['/repo'] as WorktreeInfo[] | undefined)?.some(
          (w) => w.name === 'from-other-tab',
        ),
      ).toBe(true);
    });

    it('worktree:removed broadcast patches cache', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.git()!.setProjectRoot('/repo');
      priming.git()!.addWorktree({
        name: 'to-remove',
        path: '/repo/.claude/worktrees/to-remove',
        branch: 'worktree-to-remove',
      });
      const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.list('/repo');
      });

      await act(async () => {
        await priming.claude().initialize({ launch: { cwd: '/repo' } });
        await priming.claude().send('git:worktree:remove', {
          projectCwd: '/repo',
          name: 'to-remove',
          force: true,
        });
      });

      expect(
        (result.current.listing['/repo'] as WorktreeInfo[] | undefined)?.some(
          (w) => w.name === 'to-remove',
        ),
      ).toBe(false);
    });

    it('worktree:added broadcast for not-yet-fetched project is ignored', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.git()!.setProjectRoot('/repo');
      const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });

      await act(async () => {
        await priming.claude().initialize({ launch: { cwd: '/repo' } });
        await priming.claude().send('git:worktree:add', {
          cwd: '/repo',
          name: 'x',
        });
      });

      // /unfetched was never fetched → cache stays empty despite the broadcast
      expect(result.current.listing['/unfetched']).toBeUndefined();
    });
  });

  describe('worktree:branchChanged broadcast (Phase 10.13)', () => {
    it('updates the matching worktree entry branch in-place', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.git()!.setProjectRoot('/repo');
      priming.git()!.addWorktree({
        name: 'wt1',
        path: '/repo/.claude/worktrees/wt1',
        branch: 'old-branch',
      });
      const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.list('/repo');
      });

      // Trigger branchChanged via real checkout on the priming summoner
      await act(async () => {
        await priming.claude().initialize({ launch: { cwd: '/repo' } });
        await priming.claude().send('git:checkout', {
          cwd: '/repo/.claude/worktrees/wt1',
          branch: 'new-branch',
        });
      });

      const entry = result.current.listing['/repo'] as WorktreeInfo[] | undefined;
      const wt = entry?.find((w) => w.path === '/repo/.claude/worktrees/wt1');
      expect(wt?.branch).toBe('new-branch');
    });
  });

  describe('listBranches (Phase 10.8b)', () => {
    it('git repo → returns branch array', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.git()!.setProjectRoot('/repo');
      const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });
      let res: Awaited<ReturnType<typeof result.current.listBranches>> | undefined;
      await act(async () => {
        res = await result.current.listBranches('/repo');
      });
      expect(Array.isArray(res)).toBe(true);
      expect(res).toContain('main');
    });

    it('non-git → { error }', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.git()!.setProjectRoot(null);
      const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });
      let res: Awaited<ReturnType<typeof result.current.listBranches>> | undefined;
      await act(async () => {
        res = await result.current.listBranches('/notes');
      });
      expect(res).toMatchObject({ error: 'not_a_repo' });
    });
  });

  describe('useGitStatus (external store via useSyncExternalStore)', () => {
    it('two consumers for the same cwd produce exactly one git:status RPC', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      priming.git()!.setProjectRoot('/repo');
      const statusSpy = vi.spyOn(priming.git()!, 'status');

      function Consumer() {
        useGitStatus('/repo');
        return null;
      }
      render(
        <Wrapper>
          <Consumer />
          <Consumer />
        </Wrapper>,
      );

      await waitFor(() => {
        expect(statusSpy).toHaveBeenCalled();
      });
      expect(statusSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the fetched status after first mount', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      priming.git()!.setProjectRoot('/repo');

      const { result } = renderHook(() => useGitStatus('/repo'), { wrapper: Wrapper });
      expect(result.current).toBeUndefined();
      await waitFor(() => {
        expect(result.current).toBeDefined();
      });
      expect(result.current).toHaveProperty('branch');
    });

    it('switching cwd back to a cached cwd is synchronous (zero flicker)', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/a', '/b']);
      priming.git()!.setProjectRoot('/a');

      const { result, rerender } = renderHook(({ cwd }) => useGitStatus(cwd), {
        wrapper: Wrapper,
        initialProps: { cwd: '/a' },
      });
      await waitFor(() => expect(result.current).toBeDefined());
      const aValue = result.current;

      rerender({ cwd: '/b' });
      await waitFor(() => expect(result.current).toBeDefined());

      // Switch back — useSyncExternalStore reads getSnapshot synchronously,
      // so result.current equals aValue immediately (no undefined flicker).
      rerender({ cwd: '/a' });
      expect(result.current).toBe(aValue);
    });

    it('git:dirty for un-subscribed cwd does not fetch', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      priming.git()!.setProjectRoot('/repo');
      const statusSpy = vi.spyOn(priming.git()!, 'status');

      renderHook(() => useGitActions(), { wrapper: Wrapper });
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('worktree:branchChanged for subscribed worktree cwd triggers refetch', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      priming.git()!.setProjectRoot('/repo');
      priming.git()!.addWorktree({
        name: 'wt1',
        path: '/repo/.claude/worktrees/wt1',
        branch: 'old-branch',
      });
      const statusSpy = vi.spyOn(priming.git()!, 'status');

      const { result } = renderHook(() => useGitStatus('/repo/.claude/worktrees/wt1'), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(statusSpy).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await priming.claude().initialize({ launch: { cwd: '/repo' } });
        await priming.claude().send('git:checkout', {
          cwd: '/repo/.claude/worktrees/wt1',
          branch: 'new-branch',
        });
      });

      await waitFor(() => {
        expect(statusSpy).toHaveBeenCalledTimes(2);
      });
      expect(result.current).toHaveProperty('branch');
    });
  });

  describe('worktree:branchChanged unsubscribed cache (Phase 10.13)', () => {
    it('does NOT cache git status for un-subscribed worktree path on branchChanged', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.filesystem().setRoots(['/repo']);
      priming.git()!.setProjectRoot('/repo');
      priming.git()!.addWorktree({
        name: 'wt1',
        path: '/repo/.claude/worktrees/wt1',
        branch: 'old-branch',
      });
      const statusSpy = vi.spyOn(priming.git()!, 'status');

      // Render hook WITHOUT subscribing to wt1's status
      renderHook(() => useGitActions(), { wrapper: Wrapper });

      await act(async () => {
        await priming.claude().initialize({ launch: { cwd: '/repo' } });
        await priming.claude().send('git:checkout', {
          cwd: '/repo/.claude/worktrees/wt1',
          branch: 'new-branch',
        });
      });

      // No subscriber → no fetch. Otherwise the cache grows unbounded with
      // entries nobody reads.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('initRepo (Phase 4)', () => {
    it('initRepo on non-git path → marks listing with main worktree', async () => {
      const { Wrapper } = makeEnv();
      const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });

      // First prime cache to know /notes is not-a-repo
      await act(async () => {
        await result.current.list('/notes');
      });
      expect(result.current.listing['/notes']).toBe('not_a_repo');

      // Now init
      let res: Awaited<ReturnType<typeof result.current.initRepo>> | undefined;
      await act(async () => {
        res = await result.current.initRepo('/notes');
      });
      expect(res).toEqual({ ok: true, branch: 'main' });
      // After broadcast, listing patched from sentinel to array with main
      expect(
        (result.current.listing['/notes'] as WorktreeInfo[] | undefined)?.some(
          (w) => w.branch === 'main',
        ),
      ).toBe(true);
    });

    it('initRepo on already-a-repo path → error', async () => {
      const { Wrapper, priming } = makeEnv();
      priming.git()!.setProjectRoot('/repo');
      const { result } = renderHook(() => useWorktree(), { wrapper: Wrapper });

      let res: Awaited<ReturnType<typeof result.current.initRepo>> | undefined;
      await act(async () => {
        res = await result.current.initRepo('/repo');
      });
      expect(res).toMatchObject({ ok: false });
    });
  });
});
