/**
 * Group 9: Phase 1 integration test
 * Full flow: workspace tab management + split pane + session assignment + zoom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PaneZoomProvider } from '@/components/workspace/PaneZoomProvider';
import { SplitPane } from '@/components/workspace/SplitPane';
import { WorkspaceTabBar } from '@/components/workspace/WorkspaceTabBar';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions, usePaneState, useWorkspaceTab } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>
        <PaneZoomProvider>{children}</PaneZoomProvider>
      </TabProvider>
    </SocketProvider>
  );
}

describe('Phase 1 integration (9.1)', () => {
  it('full flow: workspace tab + split pane + session assignment + zoom', async () => {
    const user = userEvent.setup();

    function ControlPanel() {
      const { paneRoot, focusedPaneId, zoomedPaneId } = usePaneState();
      const { splitPane, setSessionInPane, focusPane, zoomPane } = usePaneActions();
      const { workspaceTabs, addWorkspaceTab } = useWorkspaceTab();

      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : null;
      const splitSecondId =
        paneRoot.type === 'split' && paneRoot.second.type === 'leaf' ? paneRoot.second.id : null;

      function countLeaves(node: typeof paneRoot): number {
        if (node.type === 'leaf') return 1;
        return countLeaves(node.first) + countLeaves(node.second);
      }

      return (
        <div>
          <span data-testid="tab-count">{workspaceTabs.length}</span>
          <span data-testid="pane-count">{countLeaves(paneRoot)}</span>
          <span data-testid="zoomed-id">{zoomedPaneId ?? 'none'}</span>
          <span data-testid="focused-id">{focusedPaneId ?? 'none'}</span>
          <button type="button" onClick={() => addWorkspaceTab()}>
            new-tab
          </button>
          <button type="button" onClick={() => splitPane('h')}>
            split-h
          </button>
          <button
            type="button"
            onClick={() => leafId && setSessionInPane(leafId, 'session-abc', null)}
          >
            set-session
          </button>
          <button type="button" onClick={() => leafId && focusPane(leafId)}>
            focus-leaf
          </button>
          <button type="button" onClick={() => splitSecondId && focusPane(splitSecondId)}>
            focus-second
          </button>
          <button type="button" onClick={() => focusedPaneId && zoomPane(focusedPaneId)}>
            zoom
          </button>
          <button type="button" onClick={() => zoomPane(null)}>
            unzoom
          </button>
        </div>
      );
    }

    render(
      <Wrapper>
        <ControlPanel />
        <WorkspaceTabBar />
        <SplitPane />
      </Wrapper>,
    );

    // Initial state: 1 workspace tab, 1 pane
    expect(screen.getByTestId('tab-count')).toHaveTextContent('1');
    expect(screen.getByTestId('pane-count')).toHaveTextContent('1');
    expect(screen.getByTestId('zoomed-id')).toHaveTextContent('none');

    // Add new workspace tab
    await user.click(screen.getByRole('button', { name: 'new-tab' }));
    expect(screen.getByTestId('tab-count')).toHaveTextContent('2');

    // Split the pane horizontally
    await user.click(screen.getByRole('button', { name: 'split-h' }));
    expect(screen.getByTestId('pane-count')).toHaveTextContent('2');

    // Focus first leaf and set session
    await user.click(screen.getByRole('button', { name: 'focus-leaf' }));
    await user.click(screen.getByRole('button', { name: 'set-session' }));

    // Focus second leaf for zoom
    await user.click(screen.getByRole('button', { name: 'focus-second' }));

    // Zoom focused pane
    await user.click(screen.getByRole('button', { name: 'zoom' }));
    expect(screen.getByTestId('zoomed-id')).not.toHaveTextContent('none');

    // SplitPane shows zoomed pane (one leaf hidden)
    const leaves = screen.getAllByTestId('split-pane-leaf');
    const hiddenCount = leaves.filter((el) => el.hasAttribute('hidden')).length;
    expect(hiddenCount).toBe(1);

    // Unzoom
    await user.click(screen.getByRole('button', { name: 'unzoom' }));
    expect(screen.getByTestId('zoomed-id')).toHaveTextContent('none');
  });
});
