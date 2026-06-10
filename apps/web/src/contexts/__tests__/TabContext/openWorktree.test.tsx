/**
 * pendingOpenWorktree 消費的真 UI 管線（fake-summoner-client 慣例）。
 *
 * 改寫自 probe-Trigger 版（測試專屬按鈕直呼 requestOpenWorktree）：驅動改走真
 * WorktreeChildList——[⋯]「Open here」menuitem / [+]「Open new chat」按鈕 →
 * NavigationContext intent → NavigationIntentBridge create+place → 真 PaneTree
 * 顯示 chat pane（ChannelProvider 經 FakeServer 真 launch）。
 * 多層驗證：① PaneTree/ChatView UI ② summoner.sentEvents('session:launch')
 * ③ container ChannelManager ④ tab state probe（保留原 tab-count/active-cwd 斷言）。
 */
import type { WorktreeInfo } from '@code-quest/git';
import { TYPES } from '@code-quest/server/test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WorktreeChildList } from '@/components/project/WorktreeChildList';
import { NavigationIntentBridge } from '@/components/workspace/NavigationIntentBridge';
import { PaneTree } from '@/components/workspace/PaneTree';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';
import { TabProvider, useTabState } from '@/contexts/TabContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { setupMatchMedia } from '@/test/fake-match-media';

function Probe() {
  const { tabs, activeTabId } = useTabState();
  const cwd = activeTabId ? tabs[activeTabId]?.cwd : null;
  return (
    <>
      <span role="status" aria-label="tab-count">
        {Object.keys(tabs).length}
      </span>
      <span role="status" aria-label="active-cwd">
        {cwd ?? 'null'}
      </span>
    </>
  );
}

const tabCount = () => screen.getByRole('status', { name: 'tab-count' }).textContent;
const activeCwd = () => screen.getByRole('status', { name: 'active-cwd' }).textContent;

const FEAT_X: WorktreeInfo = {
  name: 'feat-x',
  path: '/repo/.claude/worktrees/feat-x',
  branch: 'feat/x',
};

function renderWorktreeList(opts: {
  projectCwd: string;
  worktree: WorktreeInfo;
  /** Wrapper 層 TabProvider 的 cwd（模擬全域 TabProvider 掛在別的 project 下）。 */
  tabProviderCwd?: string;
}) {
  setupMatchMedia(1280); // desktop：[⋯] 才是 dropdown（含「Open here」menuitem）
  const { summoner, container, Wrapper } = createTestWrapper();
  summoner.claude().prepareInit();
  const git = summoner.git()!;
  git.setProjectRoot(opts.projectCwd);
  git.markAsRepo(opts.projectCwd);
  git.addWorktree(opts.worktree);

  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <Wrapper>
      <CommandPaletteProvider>
        <TabProvider cwd={opts.tabProviderCwd ?? opts.projectCwd}>
          <NavigationIntentBridge />
          <PaneTree />
          <Probe />
          <WorktreeChildList worktrees={[opts.worktree]} projectCwd={opts.projectCwd} />
        </TabProvider>
      </CommandPaletteProvider>
    </Wrapper>,
  );
  return { summoner, container, user };
}

/** [⋯] dropdown →「Open here」（forceNew=false 的真 UI 入口）。 */
async function clickOpenHere(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('More actions'));
  await user.click(await screen.findByRole('menuitem', { name: 'Open here' }));
}

describe('pendingOpenWorktree consumption (real WorktreeChildList → NavigationIntentBridge)', () => {
  it('「Open here」無既有 tab → 建 tab 並落在可見 pane；再次 Open here 切換而非新建', async () => {
    const { summoner, container, user } = renderWorktreeList({
      projectCwd: '/repo',
      worktree: FEAT_X,
    });
    expect(tabCount()).toBe('0');

    await clickOpenHere(user);

    // ④ tab state（原 probe 斷言保留）
    expect(tabCount()).toBe('1');
    expect(activeCwd()).toBe('/repo/.claude/worktrees/feat-x');

    // ① 可見結果：session 真的落入 pane（非隱形 pool）——chat 輸入框出現
    expect(await screen.findByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);

    // ② socket：真 launch、cwd 正確
    await waitFor(() =>
      expect(summoner.sentEvents('session:launch')).toMatchObject([
        { cwd: '/repo/.claude/worktrees/feat-x' },
      ]),
    );

    // ③ server：恰好一個 channel 存活
    const manager = container.get<{ getAliveChannels(): unknown[] }>(TYPES.ChannelManager);
    await waitFor(() => expect(manager.getAliveChannels()).toHaveLength(1));

    // open-or-switch：同 worktree 再次 Open here → 切到既有 tab，不新建、不重 launch
    await clickOpenHere(user);
    expect(tabCount()).toBe('1');
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    expect(summoner.sentEvents('session:launch')).toHaveLength(1);
  });

  it('forceNew（[+] Open new chat）：每次點擊都新建 tab 並 split 出新 pane', async () => {
    const { summoner, container, user } = renderWorktreeList({
      projectCwd: '/repo',
      worktree: FEAT_X,
    });
    expect(tabCount()).toBe('0');

    await user.click(screen.getByLabelText('Open new chat'));
    expect(tabCount()).toBe('1');
    expect(activeCwd()).toBe('/repo/.claude/worktrees/feat-x');
    await screen.findByPlaceholderText(/Esc to focus/i);

    await user.click(screen.getByLabelText('Open new chat'));
    expect(tabCount()).toBe('2');
    expect(activeCwd()).toBe('/repo/.claude/worktrees/feat-x');

    // ① 兩個 chat pane 並排（split），都可見
    await waitFor(() => expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(2));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);

    // ② 真 launch 了兩個不同 channel、cwd 都指向 worktree。
    //（split 會 remount 第一個 pane 的 ChannelProvider → 同 channelId 重送
    // launch，server 視為 already-exists——所以驗 distinct channelId 而非次數）
    await waitFor(() => {
      const launches = summoner.sentEvents('session:launch') as Array<{
        channelId: string;
        cwd: string;
      }>;
      expect(new Set(launches.map((p) => p.channelId)).size).toBe(2);
      for (const p of launches) expect(p.cwd).toBe('/repo/.claude/worktrees/feat-x');
    });

    // ③ server 端確實 spawn 了兩個 channel
    const manager = container.get<{ getAliveChannels(): unknown[] }>(TYPES.ChannelManager);
    await waitFor(() => expect(manager.getAliveChannels()).toHaveLength(2));
  });

  it('global TabProvider 處理任何 projectCwd 的 worktree intent（Design Decision 4：無 guard）', async () => {
    // 全域 TabProvider 掛在 /repo 下，但點的是 /other 的 worktree row——
    // cross-project intent 照常消費。
    const otherWt: WorktreeInfo = { name: 'x', path: '/other/.claude/worktrees/x', branch: 'x' };
    const { summoner, user } = renderWorktreeList({
      projectCwd: '/other',
      worktree: otherWt,
      tabProviderCwd: '/repo',
    });

    await clickOpenHere(user);

    expect(tabCount()).toBe('1');
    expect(activeCwd()).toBe('/other/.claude/worktrees/x');
    expect(await screen.findByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(summoner.sentEvents('session:launch')).toMatchObject([
        { cwd: '/other/.claude/worktrees/x' },
      ]),
    );
  });
});
