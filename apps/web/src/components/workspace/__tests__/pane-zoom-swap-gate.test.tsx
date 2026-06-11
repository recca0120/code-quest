/**
 * Phase D bug fixes (pane-tree-named-components §D):
 * - 4.1/4.2 zoom/mobile solo rendering at PaneSplit（修「zoom 不放大」佔位空洞）
 * - 4.4 DnD swap 走中央落點（決策 14：header 只當 drag source）
 * - 4.6 純 tool-pane layout 不被空狀態 gate 吃掉
 *
 * 慣例（fake-summoner-client skill / layout-sync-pipeline.test.tsx）：
 * client 與 server 都走真程式——真 provider stack（鏡射 App.tsx + Workspace.tsx 的
 * 掛載順序）＋ createFakeSummoner（內建真 createFakeServer）。驅動走真 UI：
 * split 按 pane-split-h、focus 點 pane leaf、zoom 走 KeyboardShortcutsProvider 的
 * ⌘⇧Z。probe 直呼 actions 僅做 arrange（塞 tool-pane content）；DnD 的
 * dataTransfer 假物件是 happy-dom 限制，dragStart 對象維持真 pane-header、
 * drop 對象為中央落點 drop-zone-center（置換唯一入口）。
 */
import type { PersistedLayout } from '@code-quest/schemas';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { PaneTree } from '@/components/workspace/PaneTree';
import { TabContainer } from '@/components/workspace/TabContainer';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { type PaneNode, TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { setupMatchMedia } from '@/test/fake-match-media';
import { createFakeSummoner, type FakeSummoner } from '@/test/fake-summoner';

/** useMobileMode 用 max-width:767；fake-match-media 預設 matcher 只認 min-width。 */
function viewportMatcher(query: string, width: number): boolean {
  if (query === '(max-width: 767px)') return width <= 767;
  if (query === '(min-width: 1024px)') return width >= 1024;
  if (query === '(min-width: 768px)') return width >= 768;
  return false;
}

// 預設桌面寬（toolbar split 按鈕在 mobile 會隱藏）；mobile 測試自行覆寫
beforeEach(() => {
  setupMatchMedia(1280, viewportMatcher);
});

let probeState: ReturnType<typeof usePaneState> | null = null;
let probeActions: ReturnType<typeof usePaneActions> | null = null;

function Probe() {
  probeState = usePaneState();
  probeActions = usePaneActions();
  return null;
}

function leavesOf(node: PaneNode): Extract<PaneNode, { type: 'leaf' }>[] {
  if (node.type === 'leaf') return [node];
  return [...leavesOf(node.first), ...leavesOf(node.second)];
}

/** 真 provider stack——鏡射 App.tsx（AppProviders）＋ Workspace.tsx 的掛載順序。 */
function Harness({
  summoner,
  children,
}: {
  summoner: FakeSummoner;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SocketProvider socket={summoner.socket}>
      <AppConfigProvider>
        <SessionProvider>
          <ProjectProvider>
            <NavigationProvider>
              <GitProvider>
                <FsProvider>
                  <OpenspecProvider>
                    <CommandPaletteProvider>
                      <TabProvider>
                        <KeyboardShortcutsProvider>
                          <Probe />
                          {children}
                        </KeyboardShortcutsProvider>
                      </TabProvider>
                    </CommandPaletteProvider>
                  </OpenspecProvider>
                </FsProvider>
              </GitProvider>
            </NavigationProvider>
          </ProjectProvider>
        </SessionProvider>
      </AppConfigProvider>
    </SocketProvider>
  );
}

function renderTree() {
  const summoner = createFakeSummoner();
  const user = userEvent.setup();
  const utils = render(
    <Harness summoner={summoner}>
      <PaneTree />
    </Harness>,
  );
  return {
    ...utils,
    user,
    summoner,
    state: () => probeState!,
    actions: () => probeActions!,
  };
}

describe('zoom solo rendering (4.1) — zoomed pane fills the root', () => {
  it('zoom 後不渲染 percentage wrapper 與 divider，另一個 leaf 不在 DOM', async () => {
    const { container, user, state } = renderTree();
    const firstId = leavesOf(state().paneRoot)[0]!.id;

    // 真 UI split：toolbar 的 split-h 按鈕（先 focus 該 pane 再 split）
    await user.click(screen.getByTestId('pane-split-h'));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    const otherId = leavesOf(state().paneRoot).find((l) => l.id !== firstId)!.id;

    // split 後 focus 在新 leaf——點第一個 pane 拿回 focus，再 ⌘⇧Z zoom
    await user.click(container.querySelector(`[data-pane-id="${firstId}"]`) as HTMLElement);
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');

    // zoomed leaf 是唯一渲染的 leaf，佔滿 root（無 split wrapper、無 divider、無 % style）
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.dataset.paneId).toBe(firstId);
    expect(container.querySelector(`[data-pane-id="${otherId}"]`)).toBeNull();
    expect(screen.queryByTestId('split-pane-split')).toBeNull();
    expect(screen.queryByTestId('pane-divider')).toBeNull();
    expect(screen.getByTestId('pane-zoomed-indicator')).toBeInTheDocument();

    // 再按一次 ⌘⇧Z 解除 zoom → 恢復雙 pane
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    expect(screen.getByTestId('pane-divider')).toBeInTheDocument();
  });
});

const TWO_LEAF_LAYOUT: PersistedLayout = {
  version: 2,
  tabs: [
    {
      id: 'tab-s',
      paneRoot: {
        type: 'split',
        id: 'split-1',
        direction: 'h',
        ratio: 0.5,
        first: {
          type: 'leaf',
          id: 'pane-x',
          content: { type: 'session', channelId: null, cwd: null },
        },
        second: {
          type: 'leaf',
          id: 'pane-y',
          content: { type: 'session', channelId: null, cwd: null },
        },
      },
    },
  ],
  activeTabId: 'tab-s',
};

describe('mobile solo rendering (4.2) — focused pane fills the area', () => {
  it('mobile 時只渲染 focused leaf，無 divider；轉桌面寬恢復全量渲染', async () => {
    const mm = setupMatchMedia(375, viewportMatcher);
    const { summoner } = renderTree();

    // mobile 沒有 split UI——兩-leaf layout 的真實來源是跨裝置 layout:sync
    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', { ...TWO_LEAF_LAYOUT, rev: 1 });
    });

    // sync 後 focus fallback 到第一個 leaf（pane-x）→ 它是唯一渲染的 leaf
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.dataset.paneId).toBe('pane-x');
    expect(screen.queryByTestId('pane-divider')).toBeNull();

    // mobile 下切 focus → solo 跟著換：MobileGapFixes.test.tsx 以 ⌘⌥←/→ 真 UI 驅動

    // 拉回桌面寬度 → solo 解除，split 全量渲染（divider 回來）
    act(() => mm.triggerChange(1280));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    expect(screen.getByTestId('pane-divider')).toBeInTheDocument();
  });
});

describe('central drop-zone swap (4.4／決策 14)', () => {
  it('拖 pane A 的 header 丟到 pane B 的中央落點 — 兩 leaf content 互換', async () => {
    const { container, user, summoner, state, actions } = renderTree();
    // priming：讓真 FilesView 的 fs:browse('/b') 走允許的 root（而非 error 空狀態）
    summoner.filesystem().setRoots(['/b']);
    summoner.filesystem().addDirectory('/b', ['src']);
    const firstId = leavesOf(state().paneRoot)[0]!.id;

    await user.click(screen.getByTestId('pane-split-h'));
    const secondId = leavesOf(state().paneRoot).find((l) => l.id !== firstId)!.id;
    // arrange：塞 tool-pane content（真 GitView / FilesView 隨 pane 掛載）
    act(() => {
      actions().setContentInPane(firstId, { type: 'git', target: { kind: 'fixed', cwd: '/a' } });
    });
    act(() => {
      actions().setContentInPane(secondId, {
        type: 'files',
        target: { kind: 'fixed', cwd: '/b' },
      });
    });

    const firstLeafEl = container.querySelector(`[data-pane-id="${firstId}"]`) as HTMLElement;
    const secondLeafEl = container.querySelector(`[data-pane-id="${secondId}"]`) as HTMLElement;
    expect(screen.getAllByTestId('pane-header')).toHaveLength(2);

    // happy-dom 沒有原生 DataTransfer——最小假物件補 dragStart/drop 的資料通道
    const dataTransfer = {
      data: new Map<string, string>(),
      setData(type: string, value: string) {
        this.data.set(type, value);
      },
      getData(type: string) {
        return this.data.get(type) ?? '';
      },
      effectAllowed: '',
    };
    fireEvent.dragStart(within(firstLeafEl).getByTestId('pane-header'), { dataTransfer });
    // dragenter 目標 leaf 浮出五落點，drop 在中央落點＝置換
    fireEvent.dragEnter(secondLeafEl);
    fireEvent.drop(within(secondLeafEl).getByTestId('drop-zone-center'), { dataTransfer });

    // state 層：content 互換
    const leaves = leavesOf(state().paneRoot);
    expect(leaves.find((l) => l.id === firstId)!.content.type).toBe('files');
    expect(leaves.find((l) => l.id === secondId)!.content.type).toBe('git');
    // UI 層：toolbar 的 worktree switcher label 跟著互換
    expect(
      within(firstLeafEl).getByRole('button', { name: 'worktree switcher' }),
    ).toHaveTextContent('Files');
    expect(
      within(secondLeafEl).getByRole('button', { name: 'worktree switcher' }),
    ).toHaveTextContent('Git');
  });
});

// pendingNewSession prop ＋ rerender 是 TabContainer 的公開介面（Workspace 即如此驅動）
function ContainerUI({
  summoner,
  pending = null,
}: {
  summoner: FakeSummoner;
  pending?: { cwd: string; targetPaneId?: string } | null;
}): React.JSX.Element {
  return (
    <Harness summoner={summoner}>
      <TabContainer pendingNewSession={pending} onSessionCreated={NOOP} />
    </Harness>
  );
}
const NOOP = () => {};

describe('handleCreateTab fallback — focused tool pane must not swallow the session', () => {
  it('creates a visible session even when the focused pane is a worktrees pane', async () => {
    const summoner = createFakeSummoner();
    summoner.claude().prepareInit();
    const { rerender } = render(<ContainerUI summoner={summoner} />);

    const leafId = leavesOf(probeState!.paneRoot)[0]!.id;
    act(() => probeActions!.setContentInPane(leafId, { type: 'worktrees' }));
    act(() => probeActions!.focusPane(leafId));

    rerender(<ContainerUI summoner={summoner} pending={{ cwd: '/repo/feat' }} />);

    // session must land in a pane (split), not be silently dropped —
    // 真 ChannelProvider/ChatView：compose input 可見即代表 session 渲染在 pane
    await waitFor(() => expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.getAllByTestId('pane-header')).toHaveLength(2);
    // socket 層：真的 launch 了一個（且只有一個）session
    expect(summoner.sentEvents('session:launch')).toHaveLength(1);
  });
});

describe('pendingNewSession.targetPaneId — picker session lands in the TARGET pane (worktree-centric 4.1)', () => {
  it('session fills the target empty pane, not the focused one', async () => {
    const summoner = createFakeSummoner();
    summoner.claude().prepareInit();
    const user = userEvent.setup();
    const { container, rerender } = render(<ContainerUI summoner={summoner} />);

    // arrange：先塞 git pane 讓 empty-state gate 打開，再用真 UI split 出空 pane
    const firstId = leavesOf(probeState!.paneRoot)[0]!.id;
    act(() => {
      probeActions!.setContentInPane(firstId, {
        type: 'git',
        target: { kind: 'fixed', cwd: '/a' },
      });
    });
    await user.click(screen.getByTestId('pane-split-h'));
    const emptyId = leavesOf(probeState!.paneRoot).find((l) => l.id !== firstId)!.id;
    // split 後 focus 在新 leaf——點 git pane 把 focus 拉回 firstId
    await user.click(container.querySelector(`[data-pane-id="${firstId}"]`) as HTMLElement);

    rerender(
      <ContainerUI summoner={summoner} pending={{ cwd: '/repo/feat', targetPaneId: emptyId }} />,
    );

    // state 層：session 落在 target pane，git pane 不被吞
    const target = leavesOf(probeState!.paneRoot).find((l) => l.id === emptyId);
    expect(target?.content.type).toBe('session');
    expect(target?.content.type === 'session' ? target.content.channelId : null).toBeTruthy();
    expect(leavesOf(probeState!.paneRoot).find((l) => l.id === firstId)!.content.type).toBe('git');
    // UI 層：chat compose input 渲染在 target pane 裡
    const targetEl = container.querySelector(`[data-pane-id="${emptyId}"]`) as HTMLElement;
    await waitFor(
      () => expect(within(targetEl).getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(summoner.sentEvents('session:launch')).toHaveLength(1);
  });
});

describe('empty-state gate (4.6) — 純 tool-pane layout 不被吃掉', () => {
  it('default 空狀態（單一 empty session leaf、零 session tab）顯示 No open sessions', () => {
    render(<ContainerUI summoner={createFakeSummoner()} />);
    expect(screen.getByText('No open sessions')).toBeInTheDocument();
  });

  it('git pane 存在但零 session tab — pane 照常渲染，不顯示全域 EmptyState', async () => {
    render(<ContainerUI summoner={createFakeSummoner()} />);
    const firstId = leavesOf(probeState!.paneRoot)[0]!.id;
    act(() => {
      probeActions!.setContentInPane(firstId, {
        type: 'git',
        target: { kind: 'fixed', cwd: '/repo' },
      });
    });

    expect(screen.queryByText('No open sessions')).toBeNull();
    // 真 GitView：fake git 回 status 後渲染 git-pane region
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'git-pane' })).toBeInTheDocument(),
    );
  });
});
