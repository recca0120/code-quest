import { useGitState } from '@/contexts/GitContext';
import { useProjectState } from '@/contexts/ProjectContext';

interface WorktreesPaneSession {
  channelId: string;
  cwd: string;
  title?: string;
}

interface WorktreesPaneProps {
  sessions?: WorktreesPaneSession[];
  onNewSession?: (cwd: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
}

export function WorktreesPane({
  sessions = [],
  onNewSession,
  onNewWorktree,
}: WorktreesPaneProps): React.JSX.Element {
  const { listing } = useGitState();
  const { projects } = useProjectState();

  return (
    <div
      data-testid="worktrees-pane"
      className="flex flex-col flex-1 min-w-0 min-h-0 overflow-auto"
    >
      {projects.map((project) => {
        const wts = listing[project.cwd];
        const worktrees = Array.isArray(wts) ? wts : [];
        return (
          <div key={project.cwd} className="p-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">{project.name}</p>
            <ul className="space-y-0.5">
              {worktrees.map((wt) => {
                const session = sessions.find((s) => s.cwd === wt.path);
                return (
                  <li key={wt.path} className="flex items-center justify-between gap-1 text-xs">
                    <span className="flex flex-col min-w-0">
                      <span>⎇ {wt.branch ?? wt.name}</span>
                      <span className="text-muted-foreground truncate">{wt.path}</span>
                      {session?.title && (
                        <span className="text-muted-foreground truncate">{session.title}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Open session for ⎇ ${wt.branch ?? wt.name}`}
                      onClick={() => onNewSession?.(wt.path)}
                      className="shrink-0 opacity-70 hover:opacity-100"
                    >
                      [+]
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              aria-label="New worktree"
              onClick={() => onNewWorktree?.(project.cwd)}
              className="mt-1 text-xs opacity-70 hover:opacity-100"
            >
              [+ New worktree]
            </button>
          </div>
        );
      })}
    </div>
  );
}
