/**
 * EmptyPanePicker tests
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyPanePicker } from '@/components/workspace/EmptyPanePicker';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneState } from '@/contexts/TabContext';
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
  { channelId: 'ch-1', title: 'Task A', status: 'idle' as const },
  { channelId: 'ch-2', title: 'Task B', status: 'busy' as const },
];

// 8.1: empty picker lists sessions with status
describe('EmptyPanePicker (8.1) lists sessions', () => {
  it('shows all sessions with status indicator', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={sessions} />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /Task A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Task B/i })).toBeInTheDocument();
  });

  it('shows paneLabel for sessions that have one', () => {
    render(
      <Wrapper>
        <EmptyPanePicker
          paneId="pane-1"
          sessions={[{ channelId: 'ch-1', title: 'Task A', paneLabel: 'Left' }]}
        />
      </Wrapper>,
    );
    expect(screen.getByText('(Left)')).toBeInTheDocument();
  });
});

// 8.3: selecting session fills pane
describe('EmptyPanePicker (8.3) select session fills pane', () => {
  it('clicking session sets it in pane', async () => {
    const user = userEvent.setup();
    let leafSessionId: string | null = null;

    function Test() {
      const { paneRoot } = usePaneState();
      const paneId = paneRoot.type === 'leaf' ? paneRoot.id : '';
      leafSessionId =
        paneRoot.type === 'leaf' && paneRoot.content.type === 'session'
          ? paneRoot.content.sessionId
          : null;
      return <EmptyPanePicker paneId={paneId} sessions={sessions} />;
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /Task A/i }));
    expect(leafSessionId).toBe('ch-1');
  });
});

// E.1: Tool buttons are shown inline (direct pane open)
describe('EmptyPanePicker (E.1) tool buttons', () => {
  it('shows Git, Files, Spec, Worktrees tool buttons', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={[]} />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /git/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /files/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spec/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /worktrees/i })).toBeInTheDocument();
  });
});

// E.2: EmptyPanePicker shows "More options..." button
describe('EmptyPanePicker (E.2) more options button', () => {
  it('shows "More options..." button when onOpenModal is provided', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={[]} onOpenModal={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /more options/i })).toBeInTheDocument();
  });

  it('calls onOpenModal with paneId when clicked', async () => {
    const user = userEvent.setup();
    const onOpenModal = vi.fn();
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={[]} onOpenModal={onOpenModal} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /more options/i }));
    expect(onOpenModal).toHaveBeenCalledWith('pane-1');
  });
});

// EP.2: shows new-session-in-section when availableWorktrees passed
describe('EmptyPanePicker (EP.2) shows new-session-in section', () => {
  it('renders new-session-in-section when availableWorktrees is provided', () => {
    render(
      <Wrapper>
        <EmptyPanePicker
          paneId="pane-1"
          sessions={[]}
          availableWorktrees={[
            { path: '/repo/main', branch: 'main', name: 'main', projectName: 'app' },
          ]}
          projects={[{ cwd: '/repo/main', name: 'app' }]}
          onNewSession={vi.fn()}
        />
      </Wrapper>,
    );
    expect(screen.getByTestId('new-session-in-section')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ ⎇ main/i })).toBeInTheDocument();
  });
});

// EP.3: clicking worktree button calls onNewSession with its path
describe('EmptyPanePicker (EP.3) clicking worktree button calls onNewSession', () => {
  it('calls onNewSession with the worktree path when clicked', async () => {
    const user = userEvent.setup();
    const onNewSession = vi.fn();
    render(
      <Wrapper>
        <EmptyPanePicker
          paneId="pane-1"
          sessions={[]}
          availableWorktrees={[
            { path: '/repo/main', branch: 'main', name: 'main', projectName: 'app' },
          ]}
          projects={[{ cwd: '/repo/main', name: 'app' }]}
          onNewSession={onNewSession}
        />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /\+ ⎇ main/i }));
    expect(onNewSession).toHaveBeenCalledWith('/repo/main');
  });
});

// EP.4: without availableWorktrees, new-session-in-section is not rendered
describe('EmptyPanePicker (EP.4) no new-session-in section without availableWorktrees', () => {
  it('does not render new-session-in-section when availableWorktrees is undefined', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={[]} />
      </Wrapper>,
    );
    expect(screen.queryByTestId('new-session-in-section')).not.toBeInTheDocument();
  });
});
