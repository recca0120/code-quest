import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NavigationProvider, useNavigationActions } from '@/contexts/NavigationContext';
import { TabProvider } from '@/contexts/TabContext';
import { TabContainer } from '../TabContainer.tsx';

// Mock heavy contexts that TabContainer uses but are irrelevant to filtering
vi.mock('@/contexts/SessionContext', () => ({
  useSession: () => ({ closeSession: vi.fn() }),
}));
vi.mock('@/contexts/GitContext', () => ({
  useGitState: () => ({ listing: {} }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({
    activeProjectCwd: '/projects/app',
    projects: [{ cwd: '/projects/app', name: 'app' }],
  }),
}));
// ChannelProvider / ChatView are deep — stub them out
vi.mock('@/contexts/channel', () => ({
  ChannelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../chat/ChatView.tsx', () => ({
  ChatView: () => <div data-testid="chat-view" />,
}));
const PROJECT_CWD = '/projects/app';

const INITIAL_TABS = {
  'sess-main': {
    tabStatus: 'idle' as const,
    mode: 'resume' as const,
    cwd: '/projects/app/main',
    title: 'main',
  },
  'sess-feat': {
    tabStatus: 'idle' as const,
    mode: 'resume' as const,
    cwd: '/projects/app/feat',
    title: 'feat',
  },
};

// Mock SocketProvider — TabContainer doesn't use it directly but TabProvider might
vi.mock('@/contexts/SocketContext', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSocket: () => ({ socket: null }),
}));

describe('TabContainer — new session goes to pane, not pool (anti-double-mount)', () => {
  it('when all panes are occupied, creating a new tab splits the pane instead of going to pool', async () => {
    const onSessionCreated = vi.fn();
    const { container, rerender } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );

    // Create first session via empty-state button (fills the single pane)
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(container.querySelectorAll('[data-status]').length).toBe(1);

    // Create second session via pendingNewSessionCwd — pane is occupied, should split
    rerender(
      <NavigationProvider>
        <TabProvider>
          <TabContainer pendingNewSessionCwd="/projects/app" onSessionCreated={onSessionCreated} />
        </TabProvider>
      </NavigationProvider>,
    );
    expect(onSessionCreated).toHaveBeenCalled();

    // 2 session items in SessionBar
    expect(container.querySelectorAll('[data-status]').length).toBe(2);

    // Verify pool is empty (both sessions should be in panes, not unassigned)
    const pool = container.querySelector('[data-testid="session-pool"]');
    expect(pool?.querySelectorAll('[data-testid="chat-view"]').length ?? 0).toBe(0);
  });
});

describe('TabContainer — pendingNewSessionCwd creates session in pane', () => {
  it('when pendingNewSessionCwd is provided, creates a new session assigned to a pane', async () => {
    const onSessionCreated = vi.fn();
    const { rerender } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );

    // Initially no sessions
    expect(screen.getByText('No open sessions')).toBeInTheDocument();

    // Simulate GlobalBar onNewSession: rerender with pending cwd
    rerender(
      <NavigationProvider>
        <TabProvider>
          <TabContainer
            pendingNewSessionCwd="/projects/app/feat"
            onSessionCreated={onSessionCreated}
          />
        </TabProvider>
      </NavigationProvider>,
    );

    // Should have created a session and called onSessionCreated
    await screen.findByTestId('session-bar');
    expect(onSessionCreated).toHaveBeenCalled();
    expect(screen.getByTestId('session-bar').querySelectorAll('[data-status]').length).toBe(1);
  });
});

describe('TabContainer — workspace tab switch keeps session mounted exactly once', () => {
  it('session in Tab 1 pane moves to inactive-tab container, not to pool', async () => {
    const { userEvent: userEvent2 } = await import('@testing-library/user-event');
    const user = (userEvent2 ?? (await import('@testing-library/user-event')).default).setup();
    const { container } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );

    // Create first session in Tab 1's pane
    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(container.querySelectorAll('[data-testid="chat-view"]').length).toBe(1);

    // Add workspace Tab 2 (auto-switches to Tab 2)
    await user.click(screen.getByTestId('workspace-tab-add'));

    // Session from Tab 1 must be in the inactive-tab container (not the unassigned pool)
    const inactiveContainer = container.querySelector('[data-testid="inactive-tab-sessions"]');
    expect(inactiveContainer?.querySelectorAll('[data-testid="chat-view"]').length).toBe(1);

    // Unassigned pool must be empty (ch-1 is assigned to Tab 1's pane, not unassigned)
    const pool = container.querySelector('[data-testid="session-pool"]');
    expect(pool?.querySelectorAll('[data-testid="chat-view"]').length ?? 0).toBe(0);

    // Tab 2 pane is empty → shows EmptyPanePicker
    expect(screen.getByTestId('empty-pane-picker')).toBeInTheDocument();
  });
});

describe("TabContainer — EmptyPanePicker calls onOpenModal with the empty pane's id", () => {
  it('when a split pane has one occupied and one empty, clicking "More options..." calls onOpenModal with the empty pane id', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();

    // Create session via pendingNewSessionCwd (New Session now opens modal when onOpenModal is provided)
    render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer
            onOpenModal={onOpenModal}
            pendingNewSessionCwd="/projects/app/s1"
            onSessionCreated={vi.fn()}
          />
        </TabProvider>
      </NavigationProvider>,
    );
    onOpenModal.mockClear();

    // Split horizontally — now there are 2 panes: first occupied, second empty
    await user.click(screen.getByTestId('pane-split-h'));

    // Second pane is empty — should show EmptyPanePicker with "+ Open new session..."
    const picker = await screen.findByTestId('empty-pane-picker');
    expect(picker).toBeInTheDocument();

    // Click "More options..." in the empty pane
    await user.click(screen.getByRole('button', { name: /more options/i }));

    // onOpenModal should have been called with the empty pane's id (not undefined)
    expect(onOpenModal).toHaveBeenCalledWith(expect.any(String));
  });
});

describe('TabContainer — new session after closing focused pane goes to pane (not pool)', () => {
  it('when focusedPaneId is null and paneRoot is split, new tab should appear in a pane', async () => {
    const user = userEvent.setup();

    function Wrapper({ pendingCwd }: { pendingCwd: string | null }) {
      return (
        <NavigationProvider>
          <TabProvider>
            <TabContainer pendingNewSessionCwd={pendingCwd} onSessionCreated={vi.fn()} />
          </TabProvider>
        </NavigationProvider>
      );
    }

    const { container, rerender } = render(<Wrapper pendingCwd={null} />);

    // Step 1: Create session 1 (fills empty pane) via empty-state button
    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(container.querySelectorAll('[data-status]').length).toBe(1);

    // Steps 2-3: Add sessions via pendingNewSessionCwd — each should split the pane
    rerender(<Wrapper pendingCwd="/projects/app/s2" />);
    expect(container.querySelectorAll('[data-status]').length).toBe(2);
    expect(screen.getAllByTestId('pane-header').length).toBe(2);

    rerender(<Wrapper pendingCwd="/projects/app/s3" />);
    expect(container.querySelectorAll('[data-status]').length).toBe(3);
    expect(screen.getAllByTestId('pane-header').length).toBe(3);

    // Step 4: Close the focused pane — focusedPaneId resets to null
    const focusedCloseBtn = container.querySelector(
      '[data-testid="pane-header"][data-focused] [data-testid="pane-close"]',
    );
    expect(focusedCloseBtn).not.toBeNull();
    await user.click(focusedCloseBtn as Element);
    expect(screen.getAllByTestId('pane-header').length).toBe(2);

    // Step 5: Create session 4 — BUG: focusedPaneId=null + paneRoot is split
    // → splitPaneAndAssign returns early → session goes to pool → no visible response
    rerender(<Wrapper pendingCwd="/projects/app/s4" />);

    // Should have 4 sessions in session bar
    expect(container.querySelectorAll('[data-status]').length).toBe(4);

    // Pane count should increase (session 4 split into a new pane, not hidden in pool)
    expect(screen.getAllByTestId('pane-header').length).toBe(3);
  });
});

describe('TabContainer — worktree filtering', () => {
  function countSessionItems(container: HTMLElement) {
    return container.querySelectorAll('[data-status]').length;
  }

  it('shows all tabs when no worktree is selected', () => {
    render(
      <NavigationProvider>
        <TabProvider initialState={{ tabs: INITIAL_TABS, activeTabId: 'sess-main' }}>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );
    expect(countSessionItems(screen.getByTestId('session-bar'))).toBe(2);
  });

  it('shows all sessions regardless of selectedWorktreeCwd (cross-worktree sessions visible)', async () => {
    let navActions: ReturnType<typeof useNavigationActions> | null = null;

    function Harness() {
      navActions = useNavigationActions();
      return <TabContainer />;
    }

    render(
      <NavigationProvider>
        <TabProvider initialState={{ tabs: INITIAL_TABS, activeTabId: 'sess-main' }}>
          <Harness />
        </TabProvider>
      </NavigationProvider>,
    );

    // Before filter: 2 sessions
    expect(countSessionItems(screen.getByTestId('session-bar'))).toBe(2);

    // Set worktree filter — SessionBar no longer filters by worktree
    await act(async () => {
      navActions!.setSelectedWorktree(PROJECT_CWD, '/projects/app/feat');
    });

    // All sessions remain visible even after worktree selection
    expect(countSessionItems(screen.getByTestId('session-bar'))).toBe(2);
  });
});

// Design Decision 7: Empty state "New Session" opens modal (not direct creation)
describe('TabContainer — empty state "New Session" opens modal', () => {
  it('calls onOpenModal(undefined) when no sessions exist and onOpenModal is provided', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();

    render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer onOpenModal={onOpenModal} />
        </TabProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(onOpenModal).toHaveBeenCalledWith(undefined);
    // should NOT have directly created a session
    expect(screen.queryByTestId('session-bar')).not.toBeInTheDocument();
  });

  it('falls back to direct creation when onOpenModal is not provided', async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'New Session' }));
    // session bar should appear (direct creation happened)
    expect(screen.getByTestId('session-bar')).toBeInTheDocument();
  });
});

// TabContainer passes session cwd to PaneHeader so context panel icons show
describe('TabContainer — PaneHeader receives session cwd', () => {
  it('context panel tool icons are visible when a session with cwd occupies the pane', async () => {
    // Use pendingNewSessionCwd to assign a session with a known cwd to the pane
    const { rerender } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );

    rerender(
      <NavigationProvider>
        <TabProvider>
          <TabContainer pendingNewSessionCwd="/projects/app/main" onSessionCreated={vi.fn()} />
        </TabProvider>
      </NavigationProvider>,
    );

    // Wait for session to be assigned (pendingNewSessionCwd triggers useEffect)
    await screen.findByTestId('session-bar');

    // PaneHeader should show context tool toggle buttons (📁🌿📋) when cwd is passed
    const header = screen.getByTestId('pane-header');
    expect(header.querySelector('[aria-label="Files"]')).toBeInTheDocument();
    expect(header.querySelector('[aria-label="Git"]')).toBeInTheDocument();
    expect(header.querySelector('[aria-label="Spec"]')).toBeInTheDocument();
  });
});

// TabContainer passes defaultCwd to EmptyPanePicker (T.3: focused session cwd)
describe('TabContainer — EmptyPanePicker receives cwd from focused session', () => {
  it('tool-options data-cwd uses focused session cwd when session pane is focused', async () => {
    const user = userEvent.setup();

    // Create a session with a specific cwd
    const { container, rerender } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );

    rerender(
      <NavigationProvider>
        <TabProvider>
          <TabContainer pendingNewSessionCwd="/projects/app/feat" onSessionCreated={vi.fn()} />
        </TabProvider>
      </NavigationProvider>,
    );

    // Split → new empty pane gets focus
    await user.click(screen.getByTestId('pane-split-h'));

    // Refocus the first leaf (the one with the session, cwd: /projects/app/feat)
    const leaves = container.querySelectorAll('[data-testid="split-pane-leaf"]');
    await user.click(leaves[0]!);

    // The empty pane's tool-options should now use the focused session's cwd
    const toolOptions = screen.getByTestId('tool-options');
    expect(toolOptions).toHaveAttribute('data-cwd', '/projects/app/feat');
  });

  it('tool-options data-cwd falls back to activeProjectCwd when focused pane has no session', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );

    rerender(
      <NavigationProvider>
        <TabProvider>
          <TabContainer pendingNewSessionCwd="/projects/app/feat" onSessionCreated={vi.fn()} />
        </TabProvider>
      </NavigationProvider>,
    );

    // Split → new empty pane is focused → focusedTabCwd = null → fallback activeProjectCwd
    await user.click(screen.getByTestId('pane-split-h'));

    // The empty (focused) pane's tool-options should use activeProjectCwd as fallback
    const toolOptions = screen.getByTestId('tool-options');
    expect(toolOptions).toHaveAttribute('data-cwd', '/projects/app');
  });
});

// 7.4: Session Bar [+] shows inline dropdown with worktrees (design decision 7)
describe('TabContainer (7.4) Session Bar [+] shows inline dropdown', () => {
  it('[+] shows dropdown with project worktrees from GitContext', async () => {
    const user = userEvent.setup();

    render(
      <NavigationProvider>
        <TabProvider initialState={{ tabs: INITIAL_TABS, activeTabId: 'sess-main' }}>
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'New session' }));
    // Inline dropdown shows worktree (mocked listing is empty so no worktrees shown,
    // but the dropdown itself should appear)
    expect(screen.getByTestId('new-session-dropdown')).toBeInTheDocument();
  });
});
