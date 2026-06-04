import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorktreeRow } from '../WorktreeRow.tsx';

const worktree = {
  name: 'feat-auth',
  path: '/repo/.claude/worktrees/feat-auth',
  branch: 'feat/auth',
};

const longNameWorktree = {
  name: 'worktree-agent-adf24b45165face45',
  path: '/repo/.claude/worktrees/worktree-agent-adf24b45165face45',
  branch: 'worktree-agent-adf24b45165face45',
};

describe('WorktreeRow', () => {
  it('renders branch name', () => {
    render(<WorktreeRow worktree={worktree} active={false} changes={0} onSelect={() => {}} />);
    expect(screen.getByText('feat/auth')).toBeInTheDocument();
  });

  it('calls onMoreActions when ⋯ button clicked', async () => {
    const onMoreActions = vi.fn();
    render(
      <WorktreeRow
        worktree={worktree}
        active={false}
        changes={0}
        onSelect={() => {}}
        onMoreActions={onMoreActions}
      />,
    );
    await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByLabelText('More actions'));
    expect(onMoreActions).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenNewChat when [+] button clicked', async () => {
    const onOpenNewChat = vi.fn();
    render(
      <WorktreeRow
        worktree={worktree}
        active={false}
        changes={0}
        onSelect={() => {}}
        onOpenNewChat={onOpenNewChat}
      />,
    );
    await userEvent.setup().click(screen.getByLabelText('Open new chat'));
    expect(onOpenNewChat).toHaveBeenCalled();
  });

  it('does not render [+] button when onOpenNewChat not provided', () => {
    render(<WorktreeRow worktree={worktree} active={false} changes={0} onSelect={() => {}} />);
    expect(screen.queryByLabelText('Open new chat')).not.toBeInTheDocument();
  });

  it('branch button has tooltip showing full name', () => {
    render(
      <WorktreeRow worktree={longNameWorktree} active={false} changes={0} onSelect={() => {}} />,
    );
    const btn = screen.getByLabelText(/switch branch/i);
    expect(btn).toHaveAttribute('title', 'worktree-agent-adf24b45165face45');
  });

  it('branch button tooltip shows full name even for short names', () => {
    render(<WorktreeRow worktree={worktree} active={false} changes={0} onSelect={() => {}} />);
    const btn = screen.getByLabelText(/switch branch/i);
    expect(btn).toHaveAttribute('title', 'feat/auth');
  });

  it('calls onSelect when row area clicked', async () => {
    const onSelect = vi.fn();
    render(<WorktreeRow worktree={worktree} active={false} changes={0} onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByLabelText('Open worktree feat/auth'));
    expect(onSelect).toHaveBeenCalled();
  });
});
