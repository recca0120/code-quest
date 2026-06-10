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

export interface WorktreeIdentity {
  branch?: string;
  name: string;
  projectName: string;
  projectCwd: string;
}

/**
 * cwd → identity lookup（worktree-centric D3）。顯示層優先用它反查 branch/project
 * （checkout 改名即時反映，不信 TabMeta 快照）；快照值僅為 fallback。
 */
export function useWorktreeLookup(): Map<string, WorktreeIdentity> {
  const { projects } = useProjectState();
  const { listing } = useGitState();
  return useMemo(() => {
    const map = new Map<string, WorktreeIdentity>();
    for (const p of projects) {
      const wts = listing[p.cwd];
      if (!Array.isArray(wts)) continue;
      for (const wt of wts) {
        map.set(wt.path, {
          branch: wt.branch,
          name: wt.name,
          projectName: p.name,
          projectCwd: p.cwd,
        });
      }
    }
    return map;
  }, [projects, listing]);
}
