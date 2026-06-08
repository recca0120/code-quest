import { type PaneContent, usePaneActions } from '@/contexts/TabContext';

interface SessionInfo {
  channelId: string;
  title?: string;
}

interface WorktreeInfo {
  path: string;
  name: string;
  branch?: string;
}

interface ProjectInfo {
  cwd: string;
  name: string;
}

const TOOL_OPTIONS: { label: string; content: (cwd: string) => PaneContent }[] = [
  { label: '🌿 Git', content: (cwd) => ({ type: 'git', cwd }) },
  { label: '📁 Files', content: (cwd) => ({ type: 'files', cwd }) },
  { label: '📋 Spec', content: (cwd) => ({ type: 'spec', cwd }) },
  { label: '🌲 Worktrees', content: () => ({ type: 'worktrees' }) },
];

interface EmptyPanePickerProps {
  paneId: string;
  sessions: SessionInfo[];
  cwd?: string;
  /** Legacy: flat worktrees list (single project). Use allWorktrees+projects for grouped display. */
  worktrees?: WorktreeInfo[];
  /** Grouped worktrees keyed by project cwd. */
  allWorktrees?: Record<string, WorktreeInfo[]>;
  projects?: ProjectInfo[];
  onNewSession?: () => void;
  onNewSessionInWorktree?: (cwd: string, projectCwd?: string) => void;
}

export function EmptyPanePicker({
  paneId,
  sessions,
  cwd,
  worktrees,
  allWorktrees,
  projects,
  onNewSession,
  onNewSessionInWorktree,
}: EmptyPanePickerProps): React.JSX.Element {
  const { setSessionInPane, setContentInPane, focusPane } = usePaneActions();

  function handleSelect(channelId: string) {
    setSessionInPane(paneId, channelId);
    focusPane(paneId);
  }

  return (
    <div
      data-testid="empty-pane-picker"
      className="flex flex-col items-center justify-center gap-2 p-4 h-full"
    >
      <p className="text-sm text-muted-foreground">Pick a session</p>
      <div className="flex flex-col gap-1 w-full max-w-xs">
        {sessions.map((s) => (
          <button
            key={s.channelId}
            type="button"
            onClick={() => handleSelect(s.channelId)}
            className="px-3 py-2 text-sm text-left rounded hover:bg-accent"
          >
            {s.title ?? s.channelId}
          </button>
        ))}
        {onNewSession && (
          <button
            type="button"
            onClick={onNewSession}
            className="px-3 py-2 text-sm text-left rounded hover:bg-accent text-muted-foreground"
          >
            + New session
          </button>
        )}
        <div
          data-testid="tool-options"
          data-cwd={cwd ?? ''}
          className="flex flex-col gap-1 mt-2 border-t border-border pt-2"
        >
          {TOOL_OPTIONS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={() => {
                setContentInPane(paneId, tool.content(cwd ?? ''));
                focusPane(paneId);
              }}
              className="px-3 py-2 text-sm text-left rounded hover:bg-accent text-muted-foreground"
            >
              {tool.label}
            </button>
          ))}
        </div>
        {allWorktrees && projects && projects.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground mt-2 px-1">New session in...</p>
            {projects.map((project) => {
              const wts = allWorktrees[project.cwd] ?? [];
              if (wts.length === 0) return null;
              return (
                <div key={project.cwd}>
                  <p className="text-xs text-muted-foreground px-1 pt-1">{project.name}</p>
                  {wts.map((wt) => (
                    <button
                      key={wt.path}
                      type="button"
                      onClick={() => onNewSessionInWorktree?.(wt.path, project.cwd)}
                      className="px-3 py-2 text-sm text-left rounded hover:bg-accent text-muted-foreground w-full"
                    >
                      + {wt.branch ?? wt.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </>
        ) : worktrees && worktrees.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground mt-2 px-1">New session in...</p>
            {worktrees.map((wt) => (
              <button
                key={wt.path}
                type="button"
                onClick={() => onNewSessionInWorktree?.(wt.path)}
                className="px-3 py-2 text-sm text-left rounded hover:bg-accent text-muted-foreground"
              >
                + {wt.name}
              </button>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
