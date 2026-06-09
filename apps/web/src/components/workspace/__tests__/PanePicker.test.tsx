import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanePicker } from '@/components/workspace/PanePicker';

const sessions = [
  {
    channelId: 'ch-1',
    title: 'Task A',
    status: 'idle' as const,
    branch: 'main',
    cwd: '/projects/app',
  },
  {
    channelId: 'ch-2',
    title: 'Task B',
    status: 'busy' as const,
    branch: 'feat-x',
    cwd: '/projects/app-feat',
  },
];

const projects = [
  { cwd: '/projects/app', name: 'app' },
  { cwd: '/projects/other', name: 'other' },
];

const allWorktrees = {
  '/projects/app': [
    { path: '/projects/app', branch: 'main', name: 'main' },
    { path: '/projects/app-feat', branch: 'feat-x', name: 'feat-x' },
  ],
  '/projects/other': [{ path: '/projects/other', branch: 'main', name: 'main' }],
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  sessions,
  projects,
  allWorktrees,
  activeProjectCwd: '/projects/app',
};

const pastSessions = [
  {
    id: 'past-1',
    channelId: 'ch-past-1',
    title: 'Fix login bug',
    cwd: '/projects/app',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'past-2',
    channelId: 'ch-past-2',
    title: 'Add dashboard',
    cwd: '/projects/app-feat',
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
];

// Basic open/close
describe('PanePicker — open/close', () => {
  it('renders when open is true', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getByRole('dialog', { name: /open in pane/i })).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<PanePicker {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// LT: 左欄 worktree 樹
describe('PanePicker (LT) — left panel worktree tree', () => {
  it('LT.1 lists all projects and their worktrees in left panel', () => {
    render(<PanePicker {...defaultProps} />);
    const left = screen.getByTestId('pane-picker-left');
    expect(left).toBeInTheDocument();
    expect(left).toHaveTextContent('app');
    expect(left).toHaveTextContent('other');
    expect(left).toHaveTextContent('main');
    expect(left).toHaveTextContent('feat-x');
  });

  it('LT.2 worktree with active session shows ● indicator (data-has-session=true)', () => {
    render(<PanePicker {...defaultProps} />);
    const left = screen.getByTestId('pane-picker-left');
    expect(left.querySelector('[data-has-session="true"]')).toBeInTheDocument();
  });

  it('LT.3 clicking a worktree switches right panel to that worktree', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /feat-x/i }));
    expect(screen.getByTestId('pane-picker-right')).toBeInTheDocument();
  });

  it('LT.4 default selection is active project first worktree', () => {
    render(<PanePicker {...defaultProps} />);
    // Task A is in /projects/app (main), should be visible in right panel by default
    expect(screen.getByTestId('modal-session-item-ch-1')).toBeInTheDocument();
  });

  it('[+ Add project] button calls onAddProject', async () => {
    const user = userEvent.setup();
    const onAddProject = vi.fn();
    render(<PanePicker {...defaultProps} onAddProject={onAddProject} />);
    await user.click(screen.getByRole('button', { name: /\+ Add project/i }));
    expect(onAddProject).toHaveBeenCalled();
  });
});

// PP: pastSessions / onResume / onShowHere
describe('PanePicker (PP) — pastSessions / onResume / onShowHere', () => {
  it('PP.1 renders pastSessions in Resume section for matching worktree', () => {
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    // default worktree is /projects/app (main) — only past-1 matches
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    // past-2 is for feat-x, not shown yet
    expect(screen.queryByText('Add dashboard')).not.toBeInTheDocument();
  });

  it('PP.2 clicking [Resume] calls onResume with sessionId', async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} onResume={onResume} />);
    await user.click(screen.getByRole('button', { name: /resume/i }));
    expect(onResume).toHaveBeenCalledWith('past-1');
  });

  it('PP.3 clicking [Show here] calls onShowHere with channelId and paneId', async () => {
    const user = userEvent.setup();
    const onShowHere = vi.fn();
    render(<PanePicker {...defaultProps} onShowHere={onShowHere} targetPaneId="pane-3" />);
    await user.click(screen.getByRole('button', { name: /show here/i }));
    expect(onShowHere).toHaveBeenCalledWith('ch-1', 'pane-3');
  });

  it('switching worktree shows that worktree past sessions', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    await user.click(screen.getByRole('button', { name: /feat-x/i }));
    expect(screen.getByText('Add dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });
});

// RC: 右欄內容
describe('PanePicker (RC) — right panel content', () => {
  it('RC.1 Active section shows sessions matching selected worktree', () => {
    render(<PanePicker {...defaultProps} />);
    // /projects/app (main) — Task A matches
    expect(screen.getByTestId('modal-session-item-ch-1')).toBeInTheDocument();
    // Task B is in feat-x, not shown
    expect(screen.queryByTestId('modal-session-item-ch-2')).not.toBeInTheDocument();
  });

  it('RC.1 session shows branch + status indicator', () => {
    render(<PanePicker {...defaultProps} />);
    const right = screen.getByTestId('pane-picker-right');
    expect(right).toHaveTextContent('⎇ main');
  });

  it('RC.1 session with paneLabel shows ← label', () => {
    const sessionsWithLabel = [
      {
        channelId: 'ch-1',
        title: 'Task A',
        status: 'idle' as const,
        branch: 'main',
        cwd: '/projects/app',
        paneLabel: 'Left pane',
      },
    ];
    render(<PanePicker {...defaultProps} sessions={sessionsWithLabel} />);
    expect(screen.getByText('← Left pane')).toBeInTheDocument();
  });

  it('RC.3 has [+ New session] button', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getByRole('button', { name: /\+ New session/i })).toBeInTheDocument();
  });

  it('RC.3 [+ New session] calls onNewSession with worktree path and projectCwd', async () => {
    const user = userEvent.setup();
    const onNewSession = vi.fn();
    render(<PanePicker {...defaultProps} onNewSession={onNewSession} targetPaneId="pane-1" />);
    await user.click(screen.getByRole('button', { name: /\+ New session/i }));
    expect(onNewSession).toHaveBeenCalledWith('/projects/app', '/projects/app', 'pane-1');
  });

  it('RC.4 has Git, Files, Spec tool buttons', () => {
    render(<PanePicker {...defaultProps} />);
    const right = screen.getByTestId('pane-picker-right');
    expect(right.querySelector('[data-tool="git"]')).toBeInTheDocument();
    expect(right.querySelector('[data-tool="files"]')).toBeInTheDocument();
    expect(right.querySelector('[data-tool="spec"]')).toBeInTheDocument();
  });

  it('RC.4 clicking Git button calls onOpenToolPane with worktree path', async () => {
    const user = userEvent.setup();
    const onOpenToolPane = vi.fn();
    render(<PanePicker {...defaultProps} onOpenToolPane={onOpenToolPane} targetPaneId="pane-2" />);
    await user.click(screen.getByRole('button', { name: /git/i }));
    expect(onOpenToolPane).toHaveBeenCalledWith('git', '/projects/app', 'pane-2');
  });

  it('[+ New worktree] calls onNewWorktree with projectCwd', async () => {
    const user = userEvent.setup();
    const onNewWorktree = vi.fn();
    render(<PanePicker {...defaultProps} onNewWorktree={onNewWorktree} />);
    await user.click(screen.getByRole('button', { name: /\+ New worktree/i }));
    expect(onNewWorktree).toHaveBeenCalledWith('/projects/app');
  });
});

// Design alignment
describe('PanePicker — design alignment', () => {
  it('dialog title is "Open in pane"', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getByRole('dialog', { name: /open in pane/i })).toBeInTheDocument();
  });

  it('session without pane shows no ← label', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.queryByText(/←/)).not.toBeInTheDocument();
  });
});
