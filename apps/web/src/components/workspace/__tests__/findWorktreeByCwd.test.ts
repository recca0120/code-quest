import { describe, expect, it } from 'vitest';
import { findWorktreeByCwd } from '@/utils/worktree.ts';

const listing = {
  '/projects/app': [
    { name: 'main', path: '/projects/app', branch: 'main' },
    { name: 'feat', path: '/projects/app/.claude/worktrees/feat', branch: 'feature/feat' },
  ],
};

describe('findWorktreeByCwd', () => {
  it('returns worktree info for a linked worktree cwd', () => {
    const result = findWorktreeByCwd(listing, '/projects/app/.claude/worktrees/feat');
    expect(result).toMatchObject({
      worktree: { name: 'feat', branch: 'feature/feat' },
      projectCwd: '/projects/app',
    });
  });

  it('returns null for main-tree cwd (path === projectCwd) — main worktree is not a linked worktree', () => {
    const result = findWorktreeByCwd(listing, '/projects/app');
    expect(result).toBeNull();
  });

  it('returns null for unknown cwd', () => {
    expect(findWorktreeByCwd(listing, '/projects/other')).toBeNull();
  });

  it('returns null when cwd is undefined', () => {
    expect(findWorktreeByCwd(listing, undefined)).toBeNull();
  });

  it('returns null for not_a_repo projects', () => {
    const l = { '/projects/app': 'not_a_repo' as const };
    expect(findWorktreeByCwd(l, '/projects/app')).toBeNull();
  });
});
