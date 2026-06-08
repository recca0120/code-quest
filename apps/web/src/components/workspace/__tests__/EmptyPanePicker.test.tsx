/**
 * Group 8: EmptyPanePicker tests
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
  { channelId: 'ch-1', title: 'Task A' },
  { channelId: 'ch-2', title: 'Task B' },
];

// 8.1: empty picker lists inactive sessions
describe('EmptyPanePicker (8.1) lists inactive sessions', () => {
  it('shows all available sessions in picker', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={sessions} />
      </Wrapper>,
    );
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
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

    await user.click(screen.getByText('Task A'));
    expect(leafSessionId).toBe('ch-1');
  });
});

const worktrees = [
  { path: '/projects/app/main', name: 'main' },
  { path: '/projects/app/feat-x', name: 'feat-x' },
];

// 8.2: picker shows worktree quick-entry section
describe('EmptyPanePicker (8.2) worktree new session entries', () => {
  it('shows "New session in..." section with worktree names when worktrees prop provided', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={sessions} worktrees={worktrees} />
      </Wrapper>,
    );
    expect(screen.getByText(/new session in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /main/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /feat-x/ })).toBeInTheDocument();
  });

  it('does not show section when worktrees is empty or absent', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={sessions} />
      </Wrapper>,
    );
    expect(screen.queryByText(/new session in/i)).not.toBeInTheDocument();
  });
});

// 8.4: clicking worktree entry calls onNewSessionInWorktree with that cwd
describe('EmptyPanePicker (8.4) new session in worktree', () => {
  it('calls onNewSessionInWorktree with the worktree path when clicked', async () => {
    const user = userEvent.setup();
    const onNewSessionInWorktree = vi.fn();

    render(
      <Wrapper>
        <EmptyPanePicker
          paneId="pane-1"
          sessions={sessions}
          worktrees={worktrees}
          onNewSessionInWorktree={onNewSessionInWorktree}
        />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /feat-x/ }));
    expect(onNewSessionInWorktree).toHaveBeenCalledWith('/projects/app/feat-x');
  });
});

// P.1: New session in section grouped by project
describe('EmptyPanePicker (P.1) new session grouped by project', () => {
  const allWorktrees = {
    '/projects/app': [
      { path: '/projects/app', branch: 'main', name: 'main' },
      { path: '/projects/app-feat', branch: 'feat-x', name: 'feat-x' },
    ],
    '/projects/other': [{ path: '/projects/other', branch: 'main', name: 'main' }],
  };
  const projects = [
    { cwd: '/projects/app', name: 'app' },
    { cwd: '/projects/other', name: 'other' },
  ];

  it('groups new session entries by project name', () => {
    render(
      <Wrapper>
        <EmptyPanePicker
          paneId="pane-1"
          sessions={sessions}
          allWorktrees={allWorktrees}
          projects={projects}
          onNewSessionInWorktree={vi.fn()}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/new session in/i)).toBeInTheDocument();
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(screen.getByText('other')).toBeInTheDocument();
  });

  it('calls onNewSessionInWorktree with worktreePath and projectCwd', async () => {
    const user = userEvent.setup();
    const onNewSessionInWorktree = vi.fn();
    render(
      <Wrapper>
        <EmptyPanePicker
          paneId="pane-1"
          sessions={sessions}
          allWorktrees={allWorktrees}
          projects={projects}
          onNewSessionInWorktree={onNewSessionInWorktree}
        />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /feat-x/ }));
    expect(onNewSessionInWorktree).toHaveBeenCalledWith('/projects/app-feat', '/projects/app');
  });
});
