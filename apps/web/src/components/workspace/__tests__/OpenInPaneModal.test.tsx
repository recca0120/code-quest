import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OpenInPaneModal } from '@/components/workspace/OpenInPaneModal';

const sessions = [
  { channelId: 'ch-1', title: 'Task A', status: 'idle' as const, branch: 'main' },
  { channelId: 'ch-2', title: 'Task B', status: 'busy' as const, branch: 'feat-x' },
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
  activeWorktree: { path: '/projects/app', branch: 'main' },
  activeProjectCwd: '/projects/app',
};

// M.1: Modal has four tabs: Session / Git / Files / Spec
describe('OpenInPaneModal (M.1) four tabs', () => {
  it('renders Session, Git, Files, Spec tabs', () => {
    render(<OpenInPaneModal {...defaultProps} />);
    expect(screen.getByRole('tab', { name: /session/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /git/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /files/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /spec/i })).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<OpenInPaneModal {...defaultProps} open={false} />);
    expect(screen.queryByRole('tab', { name: /session/i })).not.toBeInTheDocument();
  });
});

// M.2: Session tab top half lists existing sessions (status + click to fill pane)
describe('OpenInPaneModal (M.2) session tab lists existing sessions', () => {
  it('shows existing sessions in Session tab', () => {
    render(<OpenInPaneModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Task A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Task B/i })).toBeInTheDocument();
  });

  it('calls onSelectSession with channelId when session is clicked', async () => {
    const user = userEvent.setup();
    const onSelectSession = vi.fn();
    render(<OpenInPaneModal {...defaultProps} onSelectSession={onSelectSession} />);
    await user.click(screen.getByRole('button', { name: /Task A/i }));
    expect(onSelectSession).toHaveBeenCalledWith('ch-1', undefined);
  });

  it('passes targetPaneId to onSelectSession', async () => {
    const user = userEvent.setup();
    const onSelectSession = vi.fn();
    render(
      <OpenInPaneModal {...defaultProps} onSelectSession={onSelectSession} targetPaneId="pane-3" />,
    );
    await user.click(screen.getByRole('button', { name: /Task A/i }));
    expect(onSelectSession).toHaveBeenCalledWith('ch-1', 'pane-3');
  });
});

// P.1: Session tab shows branch info alongside session title (existing sessions section)
describe('OpenInPaneModal (P.1) session shows branch', () => {
  it('shows branch info (⎇ branch) next to session title in existing sessions', () => {
    render(<OpenInPaneModal {...defaultProps} />);
    // sessions list shows "⎇ branch ·" inline within the button
    expect(screen.getByRole('button', { name: /⎇.*main.*Task A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /⎇.*feat-x.*Task B/i })).toBeInTheDocument();
  });
});

// M.3: Session tab bottom half lists "New session in" grouped by project worktrees
describe('OpenInPaneModal (M.3) new session grouped by project', () => {
  it('shows "New session in" section with projects and worktrees', () => {
    render(<OpenInPaneModal {...defaultProps} />);
    expect(screen.getByText(/new session in/i)).toBeInTheDocument();
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(screen.getByText('other')).toBeInTheDocument();
  });

  it('shows worktree branch with ⎇ prefix in new session rows', () => {
    render(<OpenInPaneModal {...defaultProps} />);
    // multiple ⎇ main exist (one per project with main branch), at least one should be present
    expect(screen.getAllByText('⎇ main').length).toBeGreaterThan(0);
    expect(screen.getByText('⎇ feat-x')).toBeInTheDocument();
  });

  it('calls onNewSession with worktree path and projectCwd', async () => {
    const user = userEvent.setup();
    const onNewSession = vi.fn();
    render(<OpenInPaneModal {...defaultProps} onNewSession={onNewSession} />);
    const newSessionBtns = screen.getAllByRole('button', { name: /\+ New session/i });
    await user.click(newSessionBtns[0]!);
    expect(onNewSession).toHaveBeenCalledWith('/projects/app', '/projects/app', undefined);
  });
});

// M.4: Each project has [+ New worktree] and [+ Add project]
describe('OpenInPaneModal (M.4) new worktree and add project', () => {
  it('renders [+ New worktree] for each project', () => {
    render(<OpenInPaneModal {...defaultProps} />);
    const newWtBtns = screen.getAllByRole('button', { name: /\+ New worktree/i });
    expect(newWtBtns).toHaveLength(2);
  });

  it('calls onNewWorktree with projectCwd when clicked', async () => {
    const user = userEvent.setup();
    const onNewWorktree = vi.fn();
    render(<OpenInPaneModal {...defaultProps} onNewWorktree={onNewWorktree} />);
    const newWtBtns = screen.getAllByRole('button', { name: /\+ New worktree/i });
    await user.click(newWtBtns[0]!);
    expect(onNewWorktree).toHaveBeenCalledWith('/projects/app');
  });

  it('renders [+ Add project] button', () => {
    render(<OpenInPaneModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /\+ Add project/i })).toBeInTheDocument();
  });

  it('calls onAddProject when [+ Add project] clicked', async () => {
    const user = userEvent.setup();
    const onAddProject = vi.fn();
    render(<OpenInPaneModal {...defaultProps} onAddProject={onAddProject} />);
    await user.click(screen.getByRole('button', { name: /\+ Add project/i }));
    expect(onAddProject).toHaveBeenCalled();
  });
});

// M.5: Tool tab shows worktree selector (label "Worktree:") pre-filled with active project active worktree
describe('OpenInPaneModal (M.5) tool tab worktree selector pre-filled', () => {
  it('Git tab shows worktree selector labelled "Worktree:" pre-filled with active worktree', async () => {
    const user = userEvent.setup();
    render(<OpenInPaneModal {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /git/i }));
    expect(screen.getByRole('combobox', { name: /worktree/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue(/main/i)).toBeInTheDocument();
  });

  it('Files tab shows worktree selector labelled "Worktree:"', async () => {
    const user = userEvent.setup();
    render(<OpenInPaneModal {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /files/i }));
    expect(screen.getByRole('combobox', { name: /worktree/i })).toBeInTheDocument();
  });

  it('Spec tab shows worktree selector labelled "Worktree:"', async () => {
    const user = userEvent.setup();
    render(<OpenInPaneModal {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /spec/i }));
    expect(screen.getByRole('combobox', { name: /worktree/i })).toBeInTheDocument();
  });
});

// M.6: Tool tab worktree selector lists options with ⎇ branch (project) format
describe('OpenInPaneModal (M.6) tool tab worktree options show ⎇ branch (project)', () => {
  it('dropdown lists worktrees with ⎇ branch (project) format', async () => {
    const user = userEvent.setup();
    render(<OpenInPaneModal {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /git/i }));
    const select = screen.getByRole('combobox', { name: /worktree/i });
    expect(within(select as HTMLElement).getByText('⎇ main (app)')).toBeInTheDocument();
    expect(within(select as HTMLElement).getByText('⎇ feat-x (app)')).toBeInTheDocument();
  });
});

// M.7: Tool tab has [Open Git/Files/Spec pane] confirm button
describe('OpenInPaneModal (M.7) open tool pane button', () => {
  it('Git tab has [Open Git pane] button', async () => {
    const user = userEvent.setup();
    render(<OpenInPaneModal {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /git/i }));
    expect(screen.getByRole('button', { name: /open git pane/i })).toBeInTheDocument();
  });

  it('Files tab has [Open Files pane] button', async () => {
    const user = userEvent.setup();
    render(<OpenInPaneModal {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /files/i }));
    expect(screen.getByRole('button', { name: /open files pane/i })).toBeInTheDocument();
  });

  it('Spec tab has [Open Spec pane] button', async () => {
    const user = userEvent.setup();
    render(<OpenInPaneModal {...defaultProps} />);
    await user.click(screen.getByRole('tab', { name: /spec/i }));
    expect(screen.getByRole('button', { name: /open spec pane/i })).toBeInTheDocument();
  });

  it('calls onOpenToolPane with type and selected cwd when confirmed', async () => {
    const user = userEvent.setup();
    const onOpenToolPane = vi.fn();
    render(<OpenInPaneModal {...defaultProps} onOpenToolPane={onOpenToolPane} />);
    await user.click(screen.getByRole('tab', { name: /git/i }));
    await user.click(screen.getByRole('button', { name: /open git pane/i }));
    expect(onOpenToolPane).toHaveBeenCalledWith('git', '/projects/app', undefined);
  });

  it('passes targetPaneId to onOpenToolPane', async () => {
    const user = userEvent.setup();
    const onOpenToolPane = vi.fn();
    render(
      <OpenInPaneModal {...defaultProps} onOpenToolPane={onOpenToolPane} targetPaneId="pane-5" />,
    );
    await user.click(screen.getByRole('tab', { name: /git/i }));
    await user.click(screen.getByRole('button', { name: /open git pane/i }));
    expect(onOpenToolPane).toHaveBeenCalledWith('git', '/projects/app', 'pane-5');
  });
});
