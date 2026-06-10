/**
 * Group 2: SplitPane component feature tests
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaneTree } from '@/components/workspace/PaneTree';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

// 2.1: single session pane renders content area
describe('SplitPane (2.1) single session pane', () => {
  it('renders a pane content area', () => {
    render(<PaneTree />, { wrapper: Wrapper });
    expect(screen.getByTestId('split-pane-root')).toBeInTheDocument();
  });
});

// 2.2: after split, two panes visible
describe('SplitPane (2.2) after split shows two panes', () => {
  it('shows two leaf panes after splitPane action', async () => {
    const user = userEvent.setup();

    function Trigger() {
      const { splitPane } = usePaneActions();
      return (
        <button type="button" onClick={() => splitPane('h')}>
          split
        </button>
      );
    }

    render(
      <Wrapper>
        <Trigger />
        <PaneTree />
      </Wrapper>,
    );

    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'split' }));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
  });
});

// 4.3 integration: after split, PaneDivider renders between panes and dragging updates ratio
describe('SplitPane (4.3) divider renders and updates ratio on drag', () => {
  it('shows pane-divider after split', async () => {
    const user = userEvent.setup();

    function Trigger() {
      const { splitPane } = usePaneActions();
      return (
        <button type="button" onClick={() => splitPane('h')}>
          split
        </button>
      );
    }

    render(
      <Wrapper>
        <Trigger />
        <PaneTree />
      </Wrapper>,
    );

    expect(screen.queryByTestId('pane-divider')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'split' }));
    expect(screen.getByTestId('pane-divider')).toBeInTheDocument();
    expect(screen.getByTestId('pane-divider')).toHaveAttribute('data-direction', 'h');
  });

  it('renders a divider with the split direction inside the split container (drag→updateRatio wiring is covered by PaneDivider.test + manual acceptance)', async () => {
    const user = userEvent.setup();

    function Trigger() {
      const { splitPane } = usePaneActions();
      return (
        <button type="button" onClick={() => splitPane('h')}>
          split
        </button>
      );
    }

    render(
      <Wrapper>
        <Trigger />
        <PaneTree />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));

    const divider = screen.getByTestId('pane-divider');
    // Verify the divider is wired to the split node (has direction matching the split)
    expect(divider).toHaveAttribute('data-direction', 'h');
    // Verify it's placed between the two pane leaves (parent is the split container)
    const splitContainer = screen.getByTestId('split-pane-split');
    expect(splitContainer.contains(divider)).toBe(true);
  });
});

// 2.3: zoom hides non-zoomed panes
import { useRef } from 'react';
import { usePaneState } from '@/contexts/TabContext';

vi.mock('@/contexts/GitContext', () => ({
  useGitState: () => ({ listing: {} }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({ activeProjectCwd: null, projects: [] }),
}));

describe('SplitPane (2.3) zoom hides other panes', () => {
  it('zoomed pane is visible; other panes are hidden', async () => {
    const user = userEvent.setup();

    function Trigger() {
      const { splitPane, zoomPane } = usePaneActions();
      const { paneRoot } = usePaneState();
      const firstLeafIdRef = useRef<string | null>(null);
      if (paneRoot.type === 'leaf' && !firstLeafIdRef.current) {
        firstLeafIdRef.current = paneRoot.id;
      }
      const firstLeafId = firstLeafIdRef.current;

      return (
        <>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button type="button" onClick={() => firstLeafId && zoomPane(firstLeafId)}>
            zoom-first
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <Trigger />
        <PaneTree />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'zoom-first' }));

    // Solo rendering: after zoom only the zoomed leaf is in the DOM —
    // no split wrapper / divider, so it truly fills the root
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    expect(screen.queryByTestId('pane-divider')).toBeNull();
  });
});
