/**
 * Group 2: SplitPane component feature tests
 *
 * 慣例（fake-summoner-client skill / layout-sync-pipeline 標竿）：
 * 真 provider stack（SocketProvider→AppConfig→Project→Git→Tab→KeyboardShortcuts），
 * 驅動全走真 UI——split 用 pane header 的 pane-split-h / pane-split-v 按鈕，
 * zoom 用 click pane 取得 focus 後 ⌘⇧Z。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { PaneTree } from '@/components/workspace/PaneTree';
import { ZoomBar } from '@/components/workspace/ZoomBar';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import { GitProvider } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function renderPaneTree() {
  const summoner = createFakeSummoner(); // 內建真 createFakeServer
  const view = render(
    <SocketProvider socket={summoner.socket}>
      <AppConfigProvider>
        <ProjectProvider>
          <GitProvider>
            <TabProvider>
              <KeyboardShortcutsProvider>
                <ZoomBar />
                <PaneTree />
              </KeyboardShortcutsProvider>
            </TabProvider>
          </GitProvider>
        </ProjectProvider>
      </AppConfigProvider>
    </SocketProvider>,
  );
  return { summoner, view };
}

// 2.1: single session pane renders content area
describe('SplitPane (2.1) single session pane', () => {
  it('renders a pane content area', () => {
    renderPaneTree();
    expect(screen.getByTestId('split-pane-root')).toBeInTheDocument();
  });
});

// 2.2: after split, two panes visible
describe('SplitPane (2.2) after split shows two panes', () => {
  it('shows two leaf panes after clicking the toolbar split button', async () => {
    const user = userEvent.setup();
    renderPaneTree();

    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    await user.click(screen.getByTestId('pane-split-h'));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
  });
});

// 4.3 integration: after split, PaneDivider renders between panes and dragging updates ratio
describe('SplitPane (4.3) divider renders and updates ratio on drag', () => {
  it('shows pane-divider after horizontal split', async () => {
    const user = userEvent.setup();
    renderPaneTree();

    expect(screen.queryByTestId('pane-divider')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('pane-split-h'));
    expect(screen.getByTestId('pane-divider')).toBeInTheDocument();
    expect(screen.getByTestId('pane-divider')).toHaveAttribute('data-direction', 'h');
  });

  it('renders a divider with the split direction inside the split container (drag→updateRatio wiring is covered by PaneDivider.test + manual acceptance)', async () => {
    const user = userEvent.setup();
    renderPaneTree();

    await user.click(screen.getByTestId('pane-split-v'));

    const divider = screen.getByTestId('pane-divider');
    // Verify the divider is wired to the split node (has direction matching the split)
    expect(divider).toHaveAttribute('data-direction', 'v');
    // Verify it's placed between the two pane leaves (parent is the split container)
    const splitContainer = screen.getByTestId('split-pane-split');
    expect(splitContainer.contains(divider)).toBe(true);
  });
});

// 2.3: zoom hides non-zoomed panes
describe('SplitPane (2.3) zoom hides other panes', () => {
  it('zoomed pane is visible; other panes are hidden', async () => {
    const user = userEvent.setup();
    renderPaneTree();

    // 記下 split 前唯一 leaf 的 id（split 後它是 first leaf、focus 落在新 leaf）
    const firstLeafId = screen.getByTestId('split-pane-leaf').dataset.paneId!;

    await user.click(screen.getByTestId('pane-split-h'));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);

    // 點第一個 pane 取得 focus → ⌘⇧Z zoom（KeyboardShortcutsProvider）
    const firstLeaf = screen
      .getAllByTestId('split-pane-leaf')
      .find((el) => el.dataset.paneId === firstLeafId)!;
    await user.click(firstLeaf);
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');

    // Solo rendering: after zoom only the zoomed leaf is in the DOM —
    // no split wrapper / divider, so it truly fills the root
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.dataset.paneId).toBe(firstLeafId);
    expect(screen.queryByTestId('pane-divider')).toBeNull();
  });
});

// P4: divider 強化（tmux-workspace-ui；spec: divider 操作）
describe('divider 強化（4.3）', () => {
  it('雙擊 divider 重設 ratio 為 50%（佈局寬度回半分）', async () => {
    const user = userEvent.setup();
    renderPaneTree();
    // split 後拖一個不對稱 ratio（直接以鍵盤微調製造偏移更穩——⌥→ ×3）
    await user.click(screen.getByTestId('pane-split-h'));
    const leaf = screen.getAllByTestId('split-pane-leaf')[0]!;
    await user.click(leaf);
    await user.keyboard('{Alt>}{ArrowRight}{ArrowRight}{ArrowRight}{/Alt}');
    const firstWrapper = () =>
      screen.getByTestId('split-pane-split').firstElementChild as HTMLElement;
    expect(firstWrapper().style.width).not.toBe('50%');

    // 雙擊回 50%
    await user.dblClick(screen.getByTestId('pane-divider'));
    expect(firstWrapper().style.width).toBe('50%');
  });

  it('⌥←/⌥→ 微調 focused pane 邊界（固定步進）', async () => {
    const user = userEvent.setup();
    renderPaneTree();
    await user.click(screen.getByTestId('pane-split-h'));
    const before = (screen.getByTestId('split-pane-split').firstElementChild as HTMLElement).style
      .width;
    await user.click(screen.getAllByTestId('split-pane-leaf')[0]!);
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    const after = (screen.getByTestId('split-pane-split').firstElementChild as HTMLElement).style
      .width;
    expect(after).not.toBe(before);
    expect(Number.parseFloat(after)).toBeGreaterThan(Number.parseFloat(before));
  });
});

// P4: zoom bar（tmux-workspace-ui；spec: zoom bar）
describe('zoom bar（4.5）', () => {
  it('zoom 時頂部出現 zoom bar（pane 編號/總數）；esc 解除返回分割', async () => {
    const user = userEvent.setup();
    renderPaneTree();
    await user.click(screen.getByTestId('pane-split-h'));
    expect(screen.queryByTestId('zoom-bar')).not.toBeInTheDocument();

    // zoom 第二個 pane
    await user.click(screen.getAllByTestId('split-pane-leaf')[1]!);
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
    const bar = screen.getByTestId('zoom-bar');
    expect(bar).toHaveTextContent(/pane ②/);
    expect(bar).toHaveTextContent(/共 2 個/);
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);

    // esc 解除 zoom
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('zoom-bar')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
  });
});

// P6.4: pane 殼精修（spec: pane-shell 共通殼）
describe('pane 編號徽章與 focused 殼樣式（6.4）', () => {
  it('每個 pane header 顯示先序編號徽章；focused pane 徽章與殼高亮', async () => {
    const user = userEvent.setup();
    renderPaneTree();
    await user.click(screen.getByTestId('pane-split-h'));

    const badges = screen.getAllByTestId('pane-index-badge');
    expect(badges.map((b) => b.textContent)).toEqual(['1', '2']);

    // focus 第二個 pane → 殼 data-focused、徽章 data-focused
    const leaves = screen.getAllByTestId('split-pane-leaf');
    await user.click(leaves[1]!);
    expect(leaves[1]).toHaveAttribute('data-focused');
    expect(leaves[0]).not.toHaveAttribute('data-focused');
    expect(badges[1]).toHaveAttribute('data-focused');
  });
});

// P6.5: pane-jump（handoff 鍵盤協定：1–9 跳到該編號 pane）
describe('⌥1–9 pane jump（6.5）', () => {
  it('⌥2 將 focus 跳到先序第 2 個 pane（⌥+數字用 e.code，避開 macOS 特殊字元）', async () => {
    const user = userEvent.setup();
    renderPaneTree();
    await user.click(screen.getByTestId('pane-split-h'));
    const leaves = screen.getAllByTestId('split-pane-leaf');
    await user.click(leaves[0]!);
    expect(leaves[0]).toHaveAttribute('data-focused');

    await user.keyboard('{Alt>}[Digit2]{/Alt}');
    expect(leaves[1]).toHaveAttribute('data-focused');
    await user.keyboard('{Alt>}[Digit1]{/Alt}');
    expect(leaves[0]).toHaveAttribute('data-focused');
  });
});
