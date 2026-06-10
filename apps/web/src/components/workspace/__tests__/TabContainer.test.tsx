/**
 * TabContainer — 真 provider 疊層整合測試（fake-summoner-client 慣例）。
 *
 * 不 mock 自家 context：Session/Project/Navigation/Git 全走真 provider
 * （createTestWrapper → SocketProvider→AppConfig→Session→Project→Navigation→Git），
 * 資料用 priming 餵 process 邊界——FakeGit worktrees 經真 git:worktree:list RPC
 * 流入 GitContext、container ProjectStore 餵 DB（projects:list 真管線載入）。
 *
 * 唯二 stub：ChannelProvider / ChatView（anti-double-mount 系列靠數
 * [data-testid=chat-view] 個數；真 ChatView 會啟動 channel pipeline，屬 process 邊界）。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabProvider } from '@/contexts/TabContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { TabContainer } from '../TabContainer.tsx';

// ChannelProvider / ChatView 是 process 邊界 stub——真 ChatView 會 launch channel；
// anti-double-mount 測試需要可數的 chat-view 佔位。
vi.mock('@/contexts/channel', () => ({
  ChannelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../chat/ChatView.tsx', () => ({
  ChatView: () => <div data-testid="chat-view" />,
}));

const PROJECT_CWD = '/projects/app';

/** 不需要 git/project 資料的測試用——真 provider 疊層、空 server state。 */
function setup() {
  return createTestWrapper();
}

describe('TabContainer — new session goes to pane, not pool (anti-double-mount)', () => {
  it('when all panes are occupied, creating a new tab splits the pane instead of going to pool', async () => {
    const onSessionCreated = vi.fn();
    const { Wrapper } = setup();
    const { container, rerender } = render(
      <Wrapper>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </Wrapper>,
    );

    // Create first session via empty-state button (fills the single pane)
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(container.querySelectorAll('[data-testid="chat-view"]').length).toBe(1);

    // Create second session via pendingNewSessionCwd — pane is occupied, should split
    rerender(
      <Wrapper>
        <TabProvider>
          <TabContainer
            pendingNewSession={{ cwd: PROJECT_CWD }}
            onSessionCreated={onSessionCreated}
          />
        </TabProvider>
      </Wrapper>,
    );
    expect(onSessionCreated).toHaveBeenCalled();

    // Verify pool is empty (both sessions should be in panes, not unassigned)
    const pool = container.querySelector('[data-testid="session-pool"]');
    expect(pool?.querySelectorAll('[data-testid="chat-view"]').length ?? 0).toBe(0);

    // Both sessions mounted exactly once — in panes
    expect(container.querySelectorAll('[data-testid="chat-view"]').length).toBe(2);
  });
});

describe('TabContainer — pendingNewSessionCwd creates session in pane', () => {
  it('when pendingNewSessionCwd is provided, creates a new session assigned to a pane', async () => {
    const onSessionCreated = vi.fn();
    const { Wrapper } = setup();
    const { rerender } = render(
      <Wrapper>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </Wrapper>,
    );

    // Initially no sessions
    expect(screen.getByText('No open sessions')).toBeInTheDocument();

    // Simulate GlobalBar onNewSession: rerender with pending cwd
    rerender(
      <Wrapper>
        <TabProvider>
          <TabContainer
            pendingNewSession={{ cwd: '/projects/app/feat' }}
            onSessionCreated={onSessionCreated}
          />
        </TabProvider>
      </Wrapper>,
    );

    // Should have created a session and called onSessionCreated
    await screen.findByTestId('chat-view');
    expect(onSessionCreated).toHaveBeenCalled();
    expect(document.querySelectorAll('[data-testid="chat-view"]').length).toBe(1);
  });
});

describe('TabContainer — workspace tab switch keeps session mounted exactly once', () => {
  it('session in Tab 1 pane moves to inactive-tab container, not to pool', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const { container } = render(
      <Wrapper>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </Wrapper>,
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

    // Mounted exactly once overall — no double mount across tab switch
    expect(container.querySelectorAll('[data-testid="chat-view"]').length).toBe(1);

    // Tab 2 pane is empty → shows "New Session" button
    expect(screen.getAllByRole('button', { name: 'New Session' }).length).toBeGreaterThan(0);
  });
});

describe("TabContainer — empty pane's 'New Session' calls onOpenModal with the pane's id", () => {
  it('when a split pane has one occupied and one empty, clicking "New Session" calls onOpenModal with the empty pane id', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();
    const { Wrapper } = setup();

    render(
      <Wrapper>
        <TabProvider>
          <TabContainer
            onOpenModal={onOpenModal}
            pendingNewSession={{ cwd: '/projects/app/s1' }}
            onSessionCreated={vi.fn()}
          />
        </TabProvider>
      </Wrapper>,
    );
    onOpenModal.mockClear();

    // Split horizontally — now there are 2 panes: first occupied, second empty
    await user.click(screen.getByTestId('pane-split-h'));

    // Second pane is empty — should show "New Session" button
    const newSessionBtns = await screen.findAllByRole('button', { name: 'New Session' });
    expect(newSessionBtns.length).toBeGreaterThan(0);

    // Click "New Session" in the empty pane (last one found)
    await user.click(newSessionBtns[newSessionBtns.length - 1]!);

    // onOpenModal should have been called with the empty pane's id (not undefined)
    expect(onOpenModal).toHaveBeenCalledWith(expect.any(String));
  });
});

describe('TabContainer — new session after closing focused pane goes to pane (not pool)', () => {
  it('when focusedPaneId is null and paneRoot is split, new tab should appear in a pane', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();

    function Harness({ pendingCwd }: { pendingCwd: string | null }) {
      return (
        <Wrapper>
          <TabProvider>
            <TabContainer
              pendingNewSession={pendingCwd ? { cwd: pendingCwd } : null}
              onSessionCreated={vi.fn()}
            />
          </TabProvider>
        </Wrapper>
      );
    }

    const { container, rerender } = render(<Harness pendingCwd={null} />);

    // Step 1: Create session 1 (fills empty pane) via empty-state button
    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(container.querySelectorAll('[data-testid="chat-view"]').length).toBe(1);

    // Steps 2-3: Add sessions via pendingNewSessionCwd — each should split the pane
    rerender(<Harness pendingCwd="/projects/app/s2" />);
    expect(container.querySelectorAll('[data-testid="chat-view"]').length).toBe(2);
    expect(screen.getAllByTestId('pane-header').length).toBe(2);

    rerender(<Harness pendingCwd="/projects/app/s3" />);
    expect(container.querySelectorAll('[data-testid="chat-view"]').length).toBe(3);
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
    rerender(<Harness pendingCwd="/projects/app/s4" />);

    // Should have 4 sessions in session bar
    expect(container.querySelectorAll('[data-testid="chat-view"]').length).toBe(4);

    // Pane count should increase (session 4 split into a new pane, not hidden in pool)
    expect(screen.getAllByTestId('pane-header').length).toBe(3);
  });
});

// Design Decision 7: Empty state "New Session" opens modal (not direct creation)
describe('TabContainer — empty state "New Session" opens modal', () => {
  it('calls onOpenModal(undefined) when no sessions exist and onOpenModal is provided', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();
    const { Wrapper } = setup();

    render(
      <Wrapper>
        <TabProvider>
          <TabContainer onOpenModal={onOpenModal} />
        </TabProvider>
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'New Session' }));
    expect(onOpenModal).toHaveBeenCalledWith(undefined);
    // should NOT have directly created a session
    expect(screen.queryByTestId('session-bar')).not.toBeInTheDocument();
  });

  it('falls back to direct creation when onOpenModal is not provided', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();

    render(
      <Wrapper>
        <TabProvider>
          <TabContainer />
        </TabProvider>
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'New Session' }));
    // a session pane should appear (direct creation happened)
    expect(await screen.findByTestId('chat-view')).toBeInTheDocument();
  });
});

// Note: ChatBreadcrumb "Toggle right pane" button integration is covered in PaneLeafContent.test.tsx
// (requires renderWithWorkspace + real SocketProvider, incompatible with this file's vi.mock setup)
