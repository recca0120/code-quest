/**
 * Group WP: WorktreesPane tests
 *
 * 慣例（fake-summoner-client skill）：不 mock GitContext/ProjectContext —
 * WorktreesPane 跑在真 SocketProvider + ProjectProvider + GitProvider 下。
 * git 資料由 priming summoner 餵 FakeGit、project 由 container ProjectStore
 * 餵 DB（真 ProjectProvider 經 projects:list 載入）；listing 經真
 * git:worktree:list RPC 進 GitContext state（Probe 的 useGitActions().list
 * 僅作 arrange）。sessions / onNewSession / onNewWorktree 是 WorktreesPane
 * 真 props，照舊由測試餵。
 */
import {
  createFakeServer,
  createTestContainer,
  type ProjectStore,
  TYPES,
} from '@code-quest/server/test';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { WorktreesPane } from '@/components/workspace/WorktreesPane';
import { GitProvider, useGitActions } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { createFakeSummoner } from '@/test/fake-summoner';

let probeGitActions: ReturnType<typeof useGitActions> | null = null;

function Probe() {
  probeGitActions = useGitActions();
  return null;
}

async function setup(props?: ComponentProps<typeof WorktreesPane>) {
  const user = userEvent.setup();
  const container = createTestContainer();
  const server = createFakeServer(container);
  onTestFinished(() => server.destroy());

  // process 邊界 priming：/project 是 repo，有 main + feat 兩個 worktree
  const priming = createFakeSummoner(server);
  const git = priming.git()!;
  git.markAsRepo('/project');
  git.setProjectRoot('/project');
  git.addWorktree({ name: 'main', path: '/project', branch: 'main' });
  git.addWorktree({ name: 'feat', path: '/project-feat', branch: 'feat/my-feature' });

  // DB：project（display name 'my-app'）— 真 ProjectProvider 經 projects:list 載入
  const store = container.get<ProjectStore>(TYPES.ProjectStore);
  const record = await store.upsert('/project');
  await store.update(record.id, { name: 'my-app' });

  const summoner = createFakeSummoner(server);
  render(
    <SocketProvider socket={summoner.socket}>
      <ProjectProvider>
        <GitProvider>
          <Probe />
          <WorktreesPane {...props} />
        </GitProvider>
      </ProjectProvider>
    </SocketProvider>,
  );

  // arrange：等 projects:list 載入，再經真 RPC 載入 worktree listing
  await waitFor(() => expect(screen.getByText('my-app')).toBeInTheDocument());
  await act(async () => {
    await probeGitActions!.list('/project');
  });
  await waitFor(() => expect(screen.getByText('⎇ main')).toBeInTheDocument());

  return { user };
}

// WP.1: WorktreesPane shows worktrees (branch + path)
describe('WorktreesPane (WP.1) shows worktrees', () => {
  it('displays branch name and path for each worktree', async () => {
    await setup();
    expect(screen.getByTestId('worktrees-pane')).toBeInTheDocument();
    expect(screen.getByText('my-app')).toBeInTheDocument();
    expect(screen.getByText('⎇ main')).toBeInTheDocument();
    expect(screen.getByText('/project')).toBeInTheDocument();
    expect(screen.getByText('⎇ feat/my-feature')).toBeInTheDocument();
    expect(screen.getByText('/project-feat')).toBeInTheDocument();
  });
});

// WP.2: each worktree has [+] button that calls onNewSession
describe('WorktreesPane (WP.2) open session button', () => {
  it('clicking [+] button calls onNewSession with worktree path', async () => {
    const onNewSession = vi.fn();
    const { user } = await setup({ onNewSession });

    await user.click(screen.getByRole('button', { name: 'Open session for ⎇ main' }));
    expect(onNewSession).toHaveBeenCalledWith('/project');

    await user.click(screen.getByRole('button', { name: 'Open session for ⎇ feat/my-feature' }));
    expect(onNewSession).toHaveBeenCalledWith('/project-feat');
  });
});

// WP.3: worktree with a session shows session title
describe('WorktreesPane (WP.3) shows session title', () => {
  it('displays title for worktrees that have a session', async () => {
    const sessions = [{ channelId: 'ch-1', cwd: '/project', title: 'Fix auth bug' }];
    await setup({ sessions });
    expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
  });
});

// WP.4: [+ New worktree] button calls onNewWorktree
describe('WorktreesPane (WP.4) new worktree button', () => {
  it('clicking [+ New worktree] calls onNewWorktree with project cwd', async () => {
    const onNewWorktree = vi.fn();
    const { user } = await setup({ onNewWorktree });

    await user.click(screen.getByRole('button', { name: 'New worktree' }));
    expect(onNewWorktree).toHaveBeenCalledWith('/project');
  });
});
