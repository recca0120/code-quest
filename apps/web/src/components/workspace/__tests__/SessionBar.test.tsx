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
              setSessionInPane(leafId, 'ch-1');
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
        <SessionBar sessions={sessions} onNewSession={vi.fn()} />
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
