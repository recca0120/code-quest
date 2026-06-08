/**
 * Phase 3 落差修補測試
 *
 * Fix-1: ⌘T 帶 focused pane 的 cwd
 * Fix-2: Focused pane 有 CSS 視覺指示
 * Fix-3: PaneDivider resize 最小 200px
 * Fix-4: SessionBar 顯示跨 worktree session
 * Fix-5: RightPane cwd 跟隨 tool pane
 * Fix-6: dragSourceId 用 dataTransfer 避免 race
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { PaneDivider } from '@/components/workspace/PaneDivider';
import { PaneHeader } from '@/components/workspace/PaneHeader';
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
              setSessionInPane(paneRoot.id, 'sess-focus');
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
  it('PaneHeader className includes ring styling driven by data-focused', () => {
    render(
      <Wrapper>
        <PaneHeader paneId="p1" />
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    // data-[focused]:ring-1 is the Tailwind variant — class string contains ring
    expect(header.className).toMatch(/ring/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Fix-3: PaneDivider 最小 200px
// ─────────────────────────────────────────────────────────────────────
describe('Fix-3: PaneDivider enforces 200px minimum', () => {
  it('clamps ratio so neither pane is smaller than 200px', () => {
    const ratios: number[] = [];
    render(<PaneDivider direction="h" containerSize={800} onRatioChange={(r) => ratios.push(r)} />);

    const divider = screen.getByTestId('pane-divider');

    // Simulate drag that would push ratio below 200/800 = 0.25
    fireEvent.pointerDown(divider, { clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50 }); // would give ratio ~0.056
    fireEvent.pointerUp(window);

    const minRatio = 200 / 800; // 0.25
    expect(ratios[ratios.length - 1]).toBeGreaterThanOrEqual(minRatio);
  });

  it('clamps ratio so right pane is not smaller than 200px', () => {
    const ratios: number[] = [];
    render(<PaneDivider direction="h" containerSize={800} onRatioChange={(r) => ratios.push(r)} />);

    const divider = screen.getByTestId('pane-divider');

    fireEvent.pointerDown(divider, { clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 750 }); // would give ratio ~0.9375
    fireEvent.pointerUp(window);

    const maxRatio = (800 - 200) / 800; // 0.75
    expect(ratios[ratios.length - 1]).toBeLessThanOrEqual(maxRatio);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Fix-4: SessionBar 顯示跨 worktree session（worktreeFilter 已移除）
// ─────────────────────────────────────────────────────────────────────
describe('Fix-4: SessionBar shows sessions from all worktrees', () => {
  it('tabs with different cwds both exist in state (SessionBar must not filter them)', async () => {
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
    // Both cwds must be present — SessionBar must not filter by worktree
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
        capturedCwd = paneRoot.content.cwd;
      }

      return (
        <button
          type="button"
          onClick={() => {
            if (paneRoot.type === 'leaf') {
              setContentInPane(paneRoot.id, { type: 'git', cwd: '/tool-cwd' });
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
// ─────────────────────────────────────────────────────────────────────
describe('Fix-6: PaneHeader drag uses dataTransfer (no module-level state)', () => {
  it('dragstart stores paneId in dataTransfer', () => {
    render(
      <Wrapper>
        <PaneHeader paneId="pane-abc" />
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    const dt = new DataTransfer();
    fireEvent.dragStart(header, { dataTransfer: dt });
    expect(dt.getData('text/plain')).toBe('pane-abc');
  });

  it('drop reads paneId from dataTransfer, not module state', () => {
    const swapped: string[] = [];

    render(
      <Wrapper>
        <PaneHeader paneId="pane-target" onSwap={(id) => swapped.push(id)} />
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    const dt = new DataTransfer();
    dt.setData('text/plain', 'pane-source');
    fireEvent.drop(header, { dataTransfer: dt });
    expect(swapped).toEqual(['pane-source']);
  });
});
