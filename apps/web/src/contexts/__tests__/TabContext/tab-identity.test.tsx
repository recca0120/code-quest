/**
 * P1 session-identity: TabMeta carries project/worktree identity at creation
 * (worktree-centric-workspace 1.1).
 *
 * 兩層：
 * 1. reducer 形狀 — 裸 TabProvider + probe（createNewTab 本身就是受測 API）。
 * 2. 全真路徑 — renderWithWorkspace + FakeGit priming，identity 從 PanePicker
 *    UI 一路寫到 socket payload 與 server channel（fake-summoner-client 慣例）。
 */
import { createFakeServer, createTestContainer, TYPES } from '@code-quest/server/test';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';
import { TabProvider, useTabActions, useTabState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

let stateProbe: ReturnType<typeof useTabState> | null = null;
let actionsProbe: ReturnType<typeof useTabActions> | null = null;

function Probe() {
  stateProbe = useTabState();
  actionsProbe = useTabActions();
  return null;
}

describe('createNewTab — identity fields (1.1)', () => {
  it('writes cwd, projectCwd and branch into TabMeta', () => {
    render(
      <TabProvider>
        <Probe />
      </TabProvider>,
    );

    let channelId = '';
    act(() => {
      channelId = actionsProbe!.createNewTab({
        cwd: '/repo/wt-feat',
        projectCwd: '/repo',
        branch: 'feat/x',
      }).channelId;
    });

    expect(stateProbe!.tabs[channelId]).toMatchObject({
      cwd: '/repo/wt-feat',
      projectCwd: '/repo',
      branch: 'feat/x',
    });
  });

  it('identity fields stay undefined when not provided (default-cwd path)', () => {
    render(
      <TabProvider cwd="/repo">
        <Probe />
      </TabProvider>,
    );

    let channelId = '';
    act(() => {
      channelId = actionsProbe!.createNewTab().channelId;
    });

    const meta = stateProbe!.tabs[channelId]!;
    expect(meta.cwd).toBe('/repo');
    expect(meta.projectCwd).toBeUndefined();
    expect(meta.branch).toBeUndefined();
  });
});

describe('identity 從 UI 端到端寫入（renderWithWorkspace 全真管線）', () => {
  it('在 feat worktree 啟動 session：launch payload 帶 worktree cwd、server 解析 projectRoot、UI 反映 branch 與 project', async () => {
    const PROJECT = '/projects/app';
    const WT_FEAT = '/projects/app-wt-feat';

    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);

    const { user, addProject } = await renderWithWorkspace({ summoner });

    // priming：feat worktree 要在 project:added 的 worktree fetch 之前進 FakeGit
    summoner.git()!.addWorktree({ name: 'wt-feat', path: WT_FEAT, branch: 'feat/x' });
    await addProject({ path: '/projects', dirName: 'app' }); // 另 primes main worktree + projectRoot

    // 真 UI：EmptyState「New Session」→ PanePicker → feat/x worktree 的 💬 AI ▶ → + New Session
    await user.click(screen.getByRole('button', { name: 'New Session' }));
    const wtSection = (await screen.findByText(/⎇ feat\/x/)).closest(
      '[data-has-session]',
    ) as HTMLElement;
    await user.click(within(wtSection).getByRole('button', { name: /💬 AI/ }));
    await user.click(await screen.findByRole('button', { name: /\+ New Session/i }));

    // ① UI：chat pane 出現（session:init 已回流）
    await screen.findAllByPlaceholderText(/Esc to focus/i);

    // ② socket：launch payload 帶 worktree cwd（projectCwd 不在 wire 上——server
    //    以 git 從 cwd 解析 projectRoot；TabMeta.projectCwd 驅動 UI 那層）
    await waitFor(() => expect(summoner.sentEvents('session:launch')).toHaveLength(1));
    const launch = summoner.sentEvents('session:launch')[0] as {
      channelId: string;
      cwd?: string;
    };
    expect(launch.cwd).toBe(WT_FEAT);
    expect(launch.channelId).toBeTruthy();

    // ③ server：channel identity — cwd 是 worktree、projectRoot 解析回 project root
    const manager = container.get<{
      getAliveChannels(): Array<[string, { cwd: string; projectRoot: string | null }]>;
    }>(TYPES.ChannelManager);
    await waitFor(() => expect(manager.getAliveChannels()).toHaveLength(1));
    const [, channel] = manager.getAliveChannels()[0]!;
    expect(channel.cwd).toBe(WT_FEAT);
    expect(channel.projectRoot).toBe(PROJECT);

    // ④ UI 反映 identity：狀態列由 focused pane cwd 反查 live worktree 清單
    //（SessionBar 已移除——⎇ 顯示由 statusline 承接）
    //    顯示 branch；breadcrumb 由 TabMeta.projectCwd 解析出 project 名稱
    expect(
      within(screen.getByTestId('workspace-statusline')).getByText(/feat\/x/),
    ).toBeInTheDocument();
    const breadcrumb = await screen.findByLabelText('chat-breadcrumb');
    expect(within(breadcrumb).getByText('app')).toBeInTheDocument();
  });
});
