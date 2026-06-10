import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorktreeLookup } from '@/components/workspace/useAvailableWorktrees';

vi.mock('@/contexts/GitContext', () => ({
  useGitState: () => ({
    listing: {
      '/repo': [
        { path: '/repo', branch: 'main', name: 'repo' },
        { path: '/repo/.claude/worktrees/feat', branch: 'feat/x', name: 'feat' },
      ],
    },
  }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({
    activeProjectCwd: '/repo',
    projects: [{ cwd: '/repo', name: 'repo' }],
  }),
}));

describe('useWorktreeLookup（worktree-centric 1.3）', () => {
  it('maps every worktree path to its identity', () => {
    const { result } = renderHook(() => useWorktreeLookup());

    expect(result.current.get('/repo/.claude/worktrees/feat')).toEqual({
      branch: 'feat/x',
      name: 'feat',
      projectName: 'repo',
      projectCwd: '/repo',
    });
    expect(result.current.get('/repo')?.branch).toBe('main');
    expect(result.current.get('/nope')).toBeUndefined();
  });
});
