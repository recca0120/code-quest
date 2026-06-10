import { useMemo } from 'react';
import { useGitState } from '@/contexts/GitContext';
import { useProjectState } from '@/contexts/ProjectContext';

export interface WorktreeOption {
  path: string;
  branch?: string;
  name: string;
  projectName?: string;
}

/**
 * Flattens projects × git worktree listing into the option list consumed by
 * WorktreeSwitcher / SessionBar / pane restore hints. Single assembly point —
 * replaced by the worktree-centric D3 cwd→identity lookup map when that lands.
 */
export function useAvailableWorktrees(): WorktreeOption[] {
  const { projects } = useProjectState();
  const { listing } = useGitState();
  return useMemo(() => {
    return projects.flatMap((p) => {
      const wts = listing[p.cwd];
      if (!Array.isArray(wts)) return [];
      return wts.map((wt) => ({
        path: wt.path,
        branch: wt.branch,
        name: wt.name,
        projectName: p.name,
      }));
    });
  }, [projects, listing]);
}
