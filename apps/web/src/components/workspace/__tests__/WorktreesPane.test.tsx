/**
 * Group WP: WorktreesPane tests
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorktreesPane } from '@/components/workspace/ToolPanes';

vi.mock('@/contexts/GitContext', () => ({
  useGitState: () => ({
    listing: {
      '/project': [
        { name: 'main', path: '/project', branch: 'main' },
        { name: 'feat', path: '/project-feat', branch: 'feat/my-feature' },
      ],
    },
  }),
}));

vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({
    projects: [{ cwd: '/project', name: 'my-app' }],
  }),
}));

// WP.1: WorktreesPane shows worktrees (branch + path)
describe('WorktreesPane (WP.1) shows worktrees', () => {
  it('displays branch name and path for each worktree', () => {
    render(<WorktreesPane />);
    expect(screen.getByTestId('worktrees-pane')).toBeInTheDocument();
    expect(screen.getByText('⎇ main')).toBeInTheDocument();
    expect(screen.getByText('/project')).toBeInTheDocument();
    expect(screen.getByText('⎇ feat/my-feature')).toBeInTheDocument();
    expect(screen.getByText('/project-feat')).toBeInTheDocument();
  });
});

// WP.2: each worktree has [+] button that calls onNewSession
describe('WorktreesPane (WP.2) open session button', () => {
  it('clicking [+] button calls onNewSession with worktree path', async () => {
    const user = userEvent.setup();
    const onNewSession = vi.fn();
    render(<WorktreesPane onNewSession={onNewSession} />);

    await user.click(screen.getByRole('button', { name: 'Open session for ⎇ main' }));
    expect(onNewSession).toHaveBeenCalledWith('/project');

    await user.click(screen.getByRole('button', { name: 'Open session for ⎇ feat/my-feature' }));
    expect(onNewSession).toHaveBeenCalledWith('/project-feat');
  });
});

// WP.3: worktree with a session shows session title
describe('WorktreesPane (WP.3) shows session title', () => {
  it('displays title for worktrees that have a session', () => {
    const sessions = [{ channelId: 'ch-1', cwd: '/project', title: 'Fix auth bug' }];
    render(<WorktreesPane sessions={sessions} />);
    expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
  });
});

// WP.4: [+ New worktree] button calls onNewWorktree
describe('WorktreesPane (WP.4) new worktree button', () => {
  it('clicking [+ New worktree] calls onNewWorktree with project cwd', async () => {
    const user = userEvent.setup();
    const onNewWorktree = vi.fn();
    render(<WorktreesPane onNewWorktree={onNewWorktree} />);

    await user.click(screen.getByRole('button', { name: 'New worktree' }));
    expect(onNewWorktree).toHaveBeenCalledWith('/project');
  });
});
