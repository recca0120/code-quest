import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorktreeRow } from '../WorktreeRow.tsx';

const worktree = {
  name: 'feat-auth',
  path: '/repo/.claude/worktrees/feat-auth',
  branch: 'feat/auth',
};

describe('WorktreeRow', () => {
  it('renders branch name', () => {
    render(
      <WorktreeRow
        worktree={worktree}
        active={false}
        liveSessions={0}
        changes={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('feat/auth')).toBeInTheDocument();
  });

  it('calls onMoreActions when ⋯ button clicked', async () => {
    const onMoreActions = vi.fn();
    render(
      <WorktreeRow
        worktree={worktree}
        active={false}
        liveSessions={0}
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
        liveSessions={0}
        changes={0}
        onSelect={() => {}}
        onOpenNewChat={onOpenNewChat}
      />,
    );
    await userEvent.setup().click(screen.getByLabelText('Open new chat'));
    expect(onOpenNewChat).toHaveBeenCalled();
  });

  it('does not render [+] button when onOpenNewChat not provided', () => {
    render(
      <WorktreeRow
        worktree={worktree}
        active={false}
        liveSessions={0}
        changes={0}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByLabelText('Open new chat')).not.toBeInTheDocument();
  });

  it('calls onSelect when row area clicked', async () => {
    const onSelect = vi.fn();
    render(
      <WorktreeRow
        worktree={worktree}
        active={false}
        liveSessions={0}
        changes={0}
        onSelect={onSelect}
      />,
    );
    await userEvent.setup().click(screen.getByLabelText('Open worktree feat/auth'));
    expect(onSelect).toHaveBeenCalled();
  });
});
