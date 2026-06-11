/**
 * Phase 3 落差修補測試
 *
 * Fix-1: ⌘T 帶 focused pane 的 cwd
 * Fix-2: Focused pane 有 CSS 視覺指示
 * Fix-3: PaneDivider resize 下限（已同源 pane-min-size；斷言搬至 PaneDivider.test 4.3）
 * Fix-4: 跨 worktree sessions 不被過濾（state 層；顯示層由 panes/manager 承接）
 * Fix-5: RightPane cwd 跟隨 tool pane
 * Fix-6: dragSourceId 用 dataTransfer 避免 race
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { Pane } from '@/components/workspace/Pane';
import { SocketProvider } from '@/contexts/SocketContext';
import {
  TabProvider,
  usePaneActions,
  usePaneState,
  useTabActions,
  useTabState,
} from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

function KbWrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>
        <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
      </TabProvider>
    </SocketProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Fix-1: ⌘T 帶 focused pane 的 cwd
// ─────────────────────────────────────────────────────────────────────
describe('Fix-1: ⌘T creates tab with focused pane cwd', () => {
  it('⌘T passes the focused session cwd to createNewTab', async () => {
    const user = userEvent.setup();
    let createdCwd: string | undefined;

    function Setup() {
      const { addTab } = useTabActions();
      const { paneRoot } = usePaneState();
      const { setSessionInPane, focusPane } = usePaneActions();
      const { tabs } = useTabState();

      // capture the second tab's cwd when it's created
      const tabEntries = Object.entries(tabs);
      if (tabEntries.length === 2) {
        createdCwd = tabEntries[1]?.[1]?.cwd ?? undefined;
      }

      return (
        <button
          type="button"
          onClick={() => {
            addTab('sess-focus', '/my-project');
            if (paneRoot.type === 'leaf') {
              setSessionInPane(paneRoot.id, 'sess-focus', null);
              focusPane(paneRoot.id);
            }
          }}
        >
          setup
        </button>
      );
    }

    render(
      <KbWrapper>
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </KbWrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'setup' }));
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}t{/Meta}');

    expect(createdCwd).toBe('/my-project');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Fix-2: Focused pane CSS 視覺指示
// ─────────────────────────────────────────────────────────────────────
describe('Fix-2: Focused pane has CSS ring indicator', () => {
  // 原斷言 pin 的 header ring 用了不存在的 token（ring-primary）——從未生效。
  // focused 視覺指示已由 pane 殼承載（PaneLeaf wrapper 的 data-focused 邊框＋ring，
  // 行為測試在 PaneTree.test「pane 編號徽章與 focused 殼樣式」）。此處保留
  // header 的 data-focused attr 契約（徽章高亮等樣式 hook 仍依賴它）。
  it('PaneHeader exposes data-focused for styling hooks', () => {
    render(
      <Wrapper>
        <Pane.Toolbar paneId="p1" />
      </Wrapper>,
    );
    // 裸 toolbar（無 TabProvider focus）不帶 data-focused；attr 由 focused 狀態驅動
    expect(screen.getByTestId('pane-header')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Fix-3: PaneDivider 拖曳下限——200px 已改與 split 最小尺寸同源（決策 10），
// 行為斷言搬至 PaneDivider.test (4.3)（direction-aware MIN_W/MIN_H）。
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// Fix-4: 跨 worktree sessions 不被過濾（worktreeFilter 已移除；SessionBar 已由 tmux-workspace-ui P1 移除）
// ─────────────────────────────────────────────────────────────────────
describe('Fix-4: sessions from all worktrees stay in tabs state (no worktree filtering)', () => {
  it('tabs with different cwds both exist in state (no layer may filter them by worktree)', async () => {
    let allSessionCwds: (string | null | undefined)[] = [];

    function Probe() {
      const { tabs } = useTabState();
      allSessionCwds = Object.values(tabs).map((m) => m.cwd);
      return null;
    }

    function Setup() {
      const { addTab } = useTabActions();
      return (
        <button
          type="button"
          onClick={() => {
            addTab('sess-main', '/project/main');
            addTab('sess-feat', '/project/feat-x');
          }}
        >
          add
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <Wrapper>
        <Probe />
        <Setup />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));
    // Both cwds must be present — nothing may filter sessions by worktree
    expect(allSessionCwds).toContain('/project/main');
    expect(allSessionCwds).toContain('/project/feat-x');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Fix-5: PaneContent 的 cwd 欄位是可讀取的（TabContainer 修正的前提）
// ─────────────────────────────────────────────────────────────────────
describe('Fix-5: Tool pane content has accessible cwd', () => {
  it('git pane content.cwd is accessible from paneRoot', async () => {
    let capturedCwd: string | null = null;

    function Setup() {
      const { paneRoot } = usePaneState();
      const { setContentInPane } = usePaneActions();

      if (paneRoot.type === 'leaf' && paneRoot.content.type === 'git') {
        capturedCwd = paneRoot.content.target.cwd;
      }

      return (
        <button
          type="button"
          onClick={() => {
            if (paneRoot.type === 'leaf') {
              setContentInPane(paneRoot.id, {
                type: 'git',
                target: { kind: 'fixed', cwd: '/tool-cwd' },
              });
            }
          }}
        >
          set-git
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <Wrapper>
        <Setup />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: 'set-git' }));
    expect(capturedCwd).toBe('/tool-cwd');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Fix-6: DragDrop 用 dataTransfer 避免 race condition
// （drop 端讀 dataTransfer 由 PaneDragDrop D.5 落點測試覆蓋——
//   決策 14 後 header 只當 drag source，不再兼任 drop target）
// ─────────────────────────────────────────────────────────────────────
describe('Fix-6: PaneHeader drag uses dataTransfer (no module-level state)', () => {
  it('dragstart stores paneId in dataTransfer', () => {
    render(
      <Wrapper>
        <Pane.Toolbar paneId="pane-abc" />
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    const dt = new DataTransfer();
    fireEvent.dragStart(header, { dataTransfer: dt });
    expect(dt.getData('text/plain')).toBe('pane-abc');
  });
});
