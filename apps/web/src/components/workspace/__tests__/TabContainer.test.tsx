import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NavigationProvider, useNavigationActions } from '@/contexts/NavigationContext';
import { TabProvider, usePaneActions, usePaneState, useTabState } from '@/contexts/TabContext';
import { TabContainer } from '../TabContainer.tsx';

// Mock heavy contexts that TabContainer uses but are irrelevant to filtering
vi.mock('@/contexts/SessionContext', () => ({
  useSession: () => ({ closeSession: vi.fn() }),
}));
vi.mock('@/contexts/GitContext', () => ({
  useGitState: () => ({ listing: {} }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({ activeProjectCwd: '/projects/app' }),
}));
vi.mock('@/hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ isDesktop: false }),
}));
// ChannelProvider / ChatView are deep — stub them out
vi.mock('@/contexts/channel', () => ({
  ChannelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../chat/ChatView.tsx', () => ({
  ChatView: () => <div data-testid="chat-view" />,
}));
vi.mock('../RightPane.tsx', () => ({
  RightPane: () => <div data-testid="right-pane" />,
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
    const { userEvent: userEvent2 } = await import('@testing-library/user-event');
    const user = (userEvent2 ?? (await import('@testing-library/user-event')).default).setup();
    const { container } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer projectCwd={PROJECT_CWD} />
        </TabProvider>
      </NavigationProvider>,
    );

    // Initially shows EmptyState "No open sessions"
    expect(screen.getByText('No open sessions')).toBeInTheDocument();

    // Create first session (goes to the single empty pane)
    await user.click(screen.getByRole('button', { name: 'New Session' }));

    // Now there is 1 session in the bar and 1 pane
    expect(container.querySelectorAll('[data-status]').length).toBe(1);

    // Create second session — pane is now occupied
    // Expected: pane splits, new session goes to the new leaf (NOT to the hidden pool)
    await user.click(screen.getByRole('button', { name: 'New tab' }));

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
          <TabContainer projectCwd={PROJECT_CWD} />
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
            projectCwd={PROJECT_CWD}
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
          <TabContainer projectCwd={PROJECT_CWD} />
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

describe('TabContainer — EmptyPanePicker "New session here" fills that pane, not focused pane', () => {
  it('when a split pane has one occupied and one empty, new session from picker fills the empty pane', async () => {
    const { userEvent: userEvent2 } = await import('@testing-library/user-event');
    const user = (userEvent2 ?? (await import('@testing-library/user-event')).default).setup();
    const { container } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer projectCwd={PROJECT_CWD} />
        </TabProvider>
      </NavigationProvider>,
    );

    // Create first session and split the pane
    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(container.querySelectorAll('[data-status]').length).toBe(1);

    // Split horizontally — now there are 2 panes: first occupied, second empty
    await user.click(screen.getByTestId('pane-split-h'));

    // Second pane is empty — should show EmptyPanePicker with "New session here"
    const picker = await screen.findByTestId('empty-pane-picker');
    expect(picker).toBeInTheDocument();

    // Click "New session here" in the EMPTY pane
    await user.click(screen.getByRole('button', { name: '+ New session' }));

    // Should now have 2 sessions in the bar
    expect(container.querySelectorAll('[data-status]').length).toBe(2);
    // Critically: still only 2 panes (no split of the occupied pane into 3 panes)
    expect(screen.getAllByTestId('pane-header').length).toBe(2);
    // Pool should be empty — both sessions are in panes
    const pool = container.querySelector('[data-testid="session-pool"]');
    expect(pool?.querySelectorAll('[data-testid="chat-view"]').length ?? 0).toBe(0);
  });
});

describe('TabContainer — new session after closing focused pane goes to pane (not pool)', () => {
  it('when focusedPaneId is null and paneRoot is split, new tab should appear in a pane', async () => {
    const { userEvent: userEvent2 } = await import('@testing-library/user-event');
    const user = (userEvent2 ?? (await import('@testing-library/user-event')).default).setup();
    const { container } = render(
      <NavigationProvider>
        <TabProvider>
          <TabContainer projectCwd={PROJECT_CWD} />
        </TabProvider>
      </NavigationProvider>,
    );

    // Step 1: Create session 1 (fills empty pane, focuses it)
    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(container.querySelectorAll('[data-status]').length).toBe(1);

    // Step 2: Create session 2 — pane splits, new pane2 gets focused
    await user.click(screen.getByRole('button', { name: 'New tab' }));
    expect(container.querySelectorAll('[data-status]').length).toBe(2);
    expect(screen.getAllByTestId('pane-header').length).toBe(2);

    // Step 3: Create session 3 — pane2 splits into pane2+pane3, pane3 focused
    await user.click(screen.getByRole('button', { name: 'New tab' }));
    expect(container.querySelectorAll('[data-status]').length).toBe(3);
    expect(screen.getAllByTestId('pane-header').length).toBe(3);

    // Step 4: Close the focused pane (pane3) — focusedPaneId resets to null, pane1+pane2 remain
    const focusedCloseBtn = container.querySelector(
      '[data-testid="pane-header"][data-focused] [data-testid="pane-close"]',
    );
    expect(focusedCloseBtn).not.toBeNull();
    await user.click(focusedCloseBtn as Element);
    expect(screen.getAllByTestId('pane-header').length).toBe(2);

    // Step 5: Create session 4 — BUG: focusedPaneId=null + paneRoot is split
    // → splitPaneAndAssign returns early → session goes to pool → no visible response
    await user.click(screen.getByRole('button', { name: 'New tab' }));

    // Should have 4 sessions in session bar
    expect(container.querySelectorAll('[data-status]').length).toBe(4);

    // Pane count should increase (session 4 was split into a new pane, not hidden in pool)
    // (Note: session 3 went to pool when its pane was closed in step 4 — that's expected)
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
          <TabContainer projectCwd={PROJECT_CWD} />
        </TabProvider>
      </NavigationProvider>,
    );
    expect(countSessionItems(screen.getByTestId('session-bar'))).toBe(2);
  });

  it('shows all sessions regardless of selectedWorktreeCwd (cross-worktree sessions visible)', async () => {
    let navActions: ReturnType<typeof useNavigationActions> | null = null;

    function Harness() {
      navActions = useNavigationActions();
      return <TabContainer projectCwd={PROJECT_CWD} />;
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

// 7.4: Session Bar [+] opens new session with focused pane's cwd
describe('TabContainer (7.4) Session Bar [+] uses focused pane cwd', () => {
  it('[+] creates a new session with the focused pane session cwd', async () => {
    const user = userEvent.setup();
    let capturedTabs: Record<string, { cwd?: string }> = {};

    function Harness() {
      const { paneRoot } = usePaneState();
      const { setSessionInPane, focusPane } = usePaneActions();
      const { tabs } = useTabState();
      capturedTabs = tabs;
      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : null;

      return (
        <>
          <button
            type="button"
            onClick={() => {
              if (leafId) {
                setSessionInPane(leafId, 'sess-main');
                focusPane(leafId);
              }
            }}
          >
            setup-focus
          </button>
          <TabContainer projectCwd={PROJECT_CWD} />
        </>
      );
    }

    render(
      <NavigationProvider>
        <TabProvider initialState={{ tabs: INITIAL_TABS, activeTabId: 'sess-main' }}>
          <Harness />
        </TabProvider>
      </NavigationProvider>,
    );

    // Setup: sess-main (cwd=/projects/app/main) is in the focused pane
    await user.click(screen.getByRole('button', { name: 'setup-focus' }));

    const tabCountBefore = Object.keys(capturedTabs).length;

    // Click [+] in SessionBar
    await user.click(screen.getByRole('button', { name: 'New tab' }));

    const tabCountAfter = Object.keys(capturedTabs).length;
    expect(tabCountAfter).toBe(tabCountBefore + 1);

    // The newly created tab should inherit focused pane's cwd
    const newTabId = Object.keys(capturedTabs).find(
      (id) => !INITIAL_TABS[id as keyof typeof INITIAL_TABS],
    );
    expect(capturedTabs[newTabId!]?.cwd).toBe('/projects/app/main');
  });
});
