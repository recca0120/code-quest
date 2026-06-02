import type { WorktreeInfo } from '@code-quest/git';

export function findWorktreeByCwd(
  listing: Record<string, WorktreeInfo[] | 'not_a_repo'>,
  cwd: string | undefined,
): { worktree: WorktreeInfo; projectCwd: string } | null {
  if (!cwd) return null;
  for (const [projectCwd, entry] of Object.entries(listing)) {
    if (!Array.isArray(entry)) continue;
    const match = entry.find((w) => w.path === cwd && w.path !== projectCwd);
    if (match) return { worktree: match, projectCwd };
  }
  return null;
}
