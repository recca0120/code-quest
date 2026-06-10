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
