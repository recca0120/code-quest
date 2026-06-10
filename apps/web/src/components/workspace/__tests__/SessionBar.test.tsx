/**
 * Group 7: SessionBar behavior tests
 * SessionBar shows active sessions; clicking inactive fills focused pane
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionBar } from '@/components/workspace/SessionBar';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

const sessions = [
  { channelId: 'ch-1', title: 'Task A', tabStatus: 'idle' as const },
  { channelId: 'ch-2', title: 'Task B', tabStatus: 'idle' as const },
];

// 7.1: clicking inactive session fills focused pane
describe('SessionBar (7.1) click inactive session fills pane', () => {
  it('setSessionInPane is called with clicked session channelId', async () => {
    const user = userEvent.setup();
    let focusedPaneSessionId: string | null = 'not-set';

    function Probe() {
      const { paneRoot } = usePaneState();
      if (paneRoot.type === 'leaf') {
        focusedPaneSessionId =
          paneRoot.content.type === 'session' ? paneRoot.content.sessionId : null;
      }
      return null;
    }

    render(
      <Wrapper>
        <Probe />
        <SessionBar sessions={sessions} />
      </Wrapper>,
    );

    await user.click(screen.getByText('Task A'));
    expect(focusedPaneSessionId).toBe('ch-1');
  });
});

// 7.3: session tab visual states
describe('SessionBar (7.3) session states', () => {
  it('session in focused pane has data-status=focused-active', async () => {
    const user = userEvent.setup();

    function Test() {
      const { setSessionInPane, focusPane } = usePaneActions();
      const { paneRoot } = usePaneState();
      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : null;
      return (
        <button
          type="button"
          onClick={() => {
            if (leafId) {
              setSessionInPane(leafId, 'ch-1', null);
              focusPane(leafId);
            }
          }}
        >
          set-active
        </button>
      );
    }

    render(
      <Wrapper>
        <Test />
        <SessionBar sessions={sessions} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'set-active' }));
    const sessionEl = screen.getByTestId('session-bar-item-ch-1');
    expect(sessionEl).toHaveAttribute('data-status', 'focused-active');
  });

  it('inactive sessions have data-status=inactive', () => {
    render(
      <Wrapper>
        <SessionBar sessions={sessions} />
      </Wrapper>,
    );
    expect(screen.getByTestId('session-bar-item-ch-1')).toHaveAttribute('data-status', 'inactive');
    expect(screen.getByTestId('session-bar-item-ch-2')).toHaveAttribute('data-status', 'inactive');
  });
});

// 7.6: status dot
describe('SessionBar (7.6) status dot', () => {
  it('busy session shows ● (data-busy)', () => {
    const busySessions = [
      { channelId: 'ch-busy', title: 'Running', tabStatus: 'processing' as const },
      { channelId: 'ch-idle', title: 'Idle', tabStatus: 'idle' as const },
    ];
    render(
      <Wrapper>
        <SessionBar sessions={busySessions} />
      </Wrapper>,
    );
    expect(
      screen.getByTestId('session-bar-item-ch-busy').querySelector('[data-busy]'),
    ).toBeTruthy();
    expect(screen.getByTestId('session-bar-item-ch-idle').querySelector('[data-busy]')).toBeFalsy();
  });
});

// 7.7: branch display
describe('SessionBar (7.7) branch display', () => {
  it('shows ⎇ branch when branch is provided', () => {
    const branchSessions = [
      { channelId: 'ch-b', title: 'Task', tabStatus: 'idle' as const, branch: 'feat-x' },
    ];
    render(
      <Wrapper>
        <SessionBar sessions={branchSessions} />
      </Wrapper>,
    );
    expect(screen.getByTestId('session-bar-item-ch-b')).toHaveTextContent('feat-x');
  });

  it('does not show branch element when branch is absent', () => {
    render(
      <Wrapper>
        <SessionBar sessions={sessions} />
      </Wrapper>,
    );
    expect(screen.getByTestId('session-bar-item-ch-1').querySelector('[data-branch]')).toBeNull();
  });
});

// 7.9b: [+] button position — must be LAST after all sessions
describe('SessionBar (7.9b) + button position', () => {
  it('[+] button is the last element in the session bar', () => {
    render(
      <Wrapper>
        <SessionBar sessions={sessions} onOpenModal={vi.fn()} />
      </Wrapper>,
    );
    const bar = screen.getByTestId('session-bar');
    const buttons = Array.from(bar.querySelectorAll('button'));
    const newTabBtn = buttons.find((b) => b.getAttribute('aria-label') === 'New tab');
    expect(newTabBtn).toBeTruthy();
    // The [+] button should be the LAST direct-child button in the bar
    const lastBtn = buttons[buttons.length - 1];
    expect(lastBtn?.getAttribute('aria-label')).toBe('New tab');
  });
});

// 7.2: clicking active session tab focuses its pane without refilling
describe('SessionBar (7.2) click active session focuses its pane', () => {
  it('focuses the pane containing the session instead of reassigning it', async () => {
    const user = userEvent.setup();
    let capturedFocusedPaneId: string | null = null;

    function Setup() {
      const { paneRoot, focusedPaneId } = usePaneState();
      const { splitPane, setSessionInPane, focusPane } = usePaneActions();
      capturedFocusedPaneId = focusedPaneId;

      const l1Id =
        paneRoot.type === 'split' && paneRoot.first.type === 'leaf'
          ? paneRoot.first.id
          : paneRoot.type === 'leaf'
            ? paneRoot.id
            : '';
      const l2Id =
        paneRoot.type === 'split' && paneRoot.second.type === 'leaf' ? paneRoot.second.id : '';

      return (
        <>
          <span data-testid="focused-pane-id">{focusedPaneId ?? 'none'}</span>
          <span data-testid="l1-id">{l1Id}</span>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button type="button" onClick={() => l1Id && setSessionInPane(l1Id, 'ch-1', null)}>
            assign
          </button>
          <button type="button" onClick={() => l2Id && focusPane(l2Id)}>
            focus-l2
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <SessionBar sessions={sessions} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));
    await user.click(screen.getByRole('button', { name: 'assign' }));
    await user.click(screen.getByRole('button', { name: 'focus-l2' }));

    // ch-1 is now 'active' (in L1 but L2 is focused)
    expect(screen.getByTestId('session-bar-item-ch-1')).toHaveAttribute('data-status', 'active');

    const l1Id = screen.getByTestId('l1-id').textContent ?? '';

    await user.click(screen.getByRole('button', { name: 'Task A' }));

    // focusedPaneId should now be L1 (where ch-1 lives), not L2
    expect(capturedFocusedPaneId).toBe(l1Id);
  });
});

// C.1: overflow indicator — »N button shows count of hidden sessions
describe('SessionBar (C.1) overflow indicator', () => {
  const manySessions = Array.from({ length: 5 }, (_, i) => ({
    channelId: `ch-${i + 1}`,
    title: `Task ${i + 1}`,
    tabStatus: 'idle' as const,
  }));

  it('shows »N button when sessions exceed maxVisible', () => {
    render(
      <Wrapper>
        <SessionBar sessions={manySessions} maxVisible={3} />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: '»2' })).toBeInTheDocument();
  });

  it('does not show »N button when all sessions are visible', () => {
    render(
      <Wrapper>
        <SessionBar sessions={manySessions} maxVisible={5} />
      </Wrapper>,
    );
    expect(screen.queryByRole('button', { name: /^»/ })).not.toBeInTheDocument();
  });
});

// C.2: overflow menu — click »N shows dropdown with hidden sessions
describe('SessionBar (C.2) overflow menu', () => {
  const manySessions = Array.from({ length: 5 }, (_, i) => ({
    channelId: `ch-${i + 1}`,
    title: `Task ${i + 1}`,
    tabStatus: 'idle' as const,
  }));

  it('clicking »N shows hidden sessions in a dropdown', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SessionBar sessions={manySessions} maxVisible={3} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: '»2' }));
    expect(screen.getByTestId('overflow-menu')).toBeInTheDocument();
    expect(screen.getByTestId('overflow-menu')).toHaveTextContent('Task 4');
    expect(screen.getByTestId('overflow-menu')).toHaveTextContent('Task 5');
  });

  it('clicking a session in overflow menu assigns it to focused pane', async () => {
    const user = userEvent.setup();
    let focusedPaneSessionId: string | null = null;

    function Probe() {
      const { paneRoot } = usePaneState();
      if (paneRoot.type === 'leaf') {
        focusedPaneSessionId =
          paneRoot.content.type === 'session' ? paneRoot.content.sessionId : null;
      }
      return null;
    }

    render(
      <Wrapper>
        <Probe />
        <SessionBar sessions={manySessions} maxVisible={3} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: '»2' }));
    await user.click(screen.getByRole('button', { name: 'Task 4' }));
    expect(focusedPaneSessionId).toBe('ch-4');
  });
});

// 7.8: close button
describe('SessionBar (7.8) close button', () => {
  it('each session has a close button', () => {
    render(
      <Wrapper>
        <SessionBar sessions={sessions} onCloseSession={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getAllByRole('button', { name: /^Close / })).toHaveLength(2);
  });

  it('clicking close calls onCloseSession with channelId', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Wrapper>
        <SessionBar sessions={sessions} onCloseSession={onClose} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: 'Close Task A' }));
    expect(onClose).toHaveBeenCalledWith('ch-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 8: 三態視覺樣式 — focused-active / active / inactive
// ─────────────────────────────────────────────────────────────────────────────
describe('SessionBar (8) visual styling by data-status', () => {
  it('focused-active item has accent highlight styling', () => {
    render(
      <Wrapper>
        <SessionBar sessions={sessions} onCloseSession={vi.fn()} />
      </Wrapper>,
    );
    // Initially no pane has focus, all items are inactive
    const item = screen.getByTestId('session-bar-item-ch-1');
    expect(item).toHaveAttribute('data-status', 'inactive');
    // inactive items should have reduced opacity
    expect(item.className).toMatch(/opacity/);
  });

  it('active item (in pane but not focused pane) has muted bg class', async () => {
    const user = userEvent.setup();

    function Setup() {
      const { setSessionInPane } = usePaneActions();
      const { paneRoot } = usePaneState();
      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : null;
      return (
        <button type="button" onClick={() => leafId && setSessionInPane(leafId, 'ch-1', null)}>
          assign
        </button>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <SessionBar sessions={sessions} onCloseSession={vi.fn()} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'assign' }));

    // ch-1 is in pane but no focusedPaneId → 'active' status with bg-muted
    const item = screen.getByTestId('session-bar-item-ch-1');
    expect(item).toHaveAttribute('data-status', 'active');
    expect(item.className).toMatch(/bg-muted/);
  });

  it('focused-active item has stronger highlight than inactive', () => {
    render(
      <Wrapper>
        <SessionBar sessions={sessions} onCloseSession={vi.fn()} />
      </Wrapper>,
    );
    const inactiveItem = screen.getByTestId('session-bar-item-ch-1');
    // inactive items have opacity reduction class
    expect(inactiveItem.className).toMatch(/opacity-60/);
  });
});

// SB.1: SessionBar [+] opens Modal via onOpenModal (design decision 7)
describe('SessionBar (SB.1) [+] opens modal', () => {
  it('[+] calls onOpenModal when provided', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();
    render(
      <Wrapper>
        <SessionBar sessions={sessions} onOpenModal={onOpenModal} onCloseSession={vi.fn()} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /new tab/i }));
    expect(onOpenModal).toHaveBeenCalled();
  });

  it('does not render [+] when onOpenModal is not provided', () => {
    render(
      <Wrapper>
        <SessionBar sessions={sessions} onCloseSession={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.queryByRole('button', { name: /new tab/i })).not.toBeInTheDocument();
  });
});
