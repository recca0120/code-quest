/**
 * useWorktreeLookup（worktree-centric 1.3）— 真 provider stack 整合測試。
 *
 * 慣例（fake-summoner-client skill）：不 mock 自家 context，hook 跑在真
 * SocketProvider + ProjectProvider + GitProvider 下。資料用 priming summoner
 * 餵 FakeGit、container ProjectStore 餵 DB；listing 經真 git:worktree:list
 * RPC 載入（GitContext list() 僅作 arrange）。
 */
import {
  createFakeServer,
  createTestContainer,
  type ProjectStore,
  TYPES,
} from '@code-quest/server/test';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useRef } from 'react';
import { describe, expect, it, onTestFinished } from 'vitest';
import { useWorktreeLookup } from '@/components/workspace/useAvailableWorktrees';
import { GitProvider, useGitActions } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { createFakeSummoner, type FakeSummoner } from '@/test/fake-summoner';

/**
 * priming summoner 先設好 server-side state；Wrapper 用第二個 summoner
 * （useRef lazy init — renderHook rerender 不重建，避免 socket 斷線）。
 */
function makeEnv() {
  const container = createTestContainer();
  const server = createFakeServer(container);
  onTestFinished(() => server.destroy());
  const priming = createFakeSummoner(server);

  function Wrapper({ children }: { children: ReactNode }) {
    const ref = useRef<FakeSummoner | null>(null);
    if (!ref.current) ref.current = createFakeSummoner(server);
    return (
      <SocketProvider socket={ref.current.socket}>
        <ProjectProvider>
          <GitProvider>{children}</GitProvider>
        </ProjectProvider>
      </SocketProvider>
    );
  }
  return { container, priming, Wrapper };
}

describe('useWorktreeLookup（worktree-centric 1.3）', () => {
  it('maps every worktree path to its identity', async () => {
    const { container, priming, Wrapper } = makeEnv();

    // priming：FakeGit worktrees + DB project（name 由 basename('/repo') 得 'repo'）
    priming.git()!.setProjectRoot('/repo');
    priming.git()!.addWorktree({ path: '/repo', branch: 'main', name: 'repo' });
    priming
      .git()!
      .addWorktree({ path: '/repo/.claude/worktrees/feat', branch: 'feat/x', name: 'feat' });
    await container.get<ProjectStore>(TYPES.ProjectStore).upsert('/repo');

    const { result } = renderHook(() => ({ lookup: useWorktreeLookup(), git: useGitActions() }), {
      wrapper: Wrapper,
    });

    // arrange：projects 已由 ProjectProvider mount 時的 projects:list 載入；
    // listing 走真 RPC 進 GitContext state
    await act(async () => {
      await result.current.git.list('/repo');
    });
    await waitFor(() => expect(result.current.lookup.size).toBe(2));

    expect(result.current.lookup.get('/repo/.claude/worktrees/feat')).toEqual({
      branch: 'feat/x',
      name: 'feat',
      projectName: 'repo',
      projectCwd: '/repo',
    });
    expect(result.current.lookup.get('/repo')?.branch).toBe('main');
    expect(result.current.lookup.get('/nope')).toBeUndefined();
  });
});
