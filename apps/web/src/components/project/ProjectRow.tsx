import type { WorktreeInfo } from '@code-quest/git';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import {
  NOT_A_REPO,
  useGitActions,
  useGitState,
  type WorktreeListingEntry,
} from '@/contexts/GitContext';
import type { Project } from '@/contexts/ProjectContext';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { GhostAddButton } from '../ui/GhostAddButton.tsx';
import { ProjectCard } from './ProjectCard.tsx';
import { WorktreeChildList } from './WorktreeChildList.tsx';

function isGit(entry: WorktreeListingEntry | undefined): entry is WorktreeInfo[] {
  return Array.isArray(entry);
}

function isNonGit(entry: WorktreeListingEntry | undefined): boolean {
  return entry === NOT_A_REPO;
}

export function ProjectRow({
  project,
  active,
  onSelect,
}: {
  project: Project;
  active: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  // Subscribe to the `expanded` array so this row re-renders when any row
  // toggles (single source of truth via zustand persist).
  const expanded = usePreferencesStore((s) => s.expandedProjects.includes(project.cwd));
  const { toggleExpanded, setExpanded } = usePreferencesStore.getState();
  const { listing } = useGitState();
  const { list, initRepo } = useGitActions();

  const entry = listing[project.cwd];
  const nonGit = isNonGit(entry);

  // Auto-expand the active project on first mount (only if user hasn't
  // already toggled it manually — stored set has precedence).
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (autoExpandedRef.current) return;
    autoExpandedRef.current = true;
    if (active && !expanded) setExpanded(project.cwd, true);
  }, [active, expanded, project.cwd, setExpanded]);

  // Fetch listing when expanded and not yet fetched.
  useEffect(() => {
    if (expanded && entry === undefined) {
      void list(project.cwd);
    }
  }, [expanded, entry, list, project.cwd]);

  return (
    <div>
      <div className="flex items-center">
        {nonGit ? (
          <span className="w-4" />
        ) : (
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${project.name}`}
            onClick={() => toggleExpanded(project.cwd)}
            className="shrink-0 p-0.5 text-muted hover:text-text"
          >
            {expanded ? (
              <ChevronDownIcon className="w-3.5 h-3.5" />
            ) : (
              <ChevronRightIcon className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <ProjectCard
            name={project.name}
            cwd={project.cwd}
            pinned={project.pinned}
            active={active}
            onSelect={() => {
              // Clicking project row = toggle expand for git projects;
              // also call through parent onSelect so active-project logic runs.
              onSelect();
              if (!nonGit) toggleExpanded(project.cwd);
            }}
            onSelectInitRepo={
              nonGit
                ? () => {
                    void initRepo(project.cwd);
                  }
                : undefined
            }
          />
        </div>
      </div>
      {expanded && isGit(entry) && <WorktreeChildList worktrees={entry} projectCwd={project.cwd} />}
      {nonGit && (
        <div className="ml-5 pl-2">
          <GhostAddButton onClick={() => void initRepo(project.cwd)} className="my-1 px-3 py-1">
            + Initialize as git repo
          </GhostAddButton>
        </div>
      )}
    </div>
  );
}
