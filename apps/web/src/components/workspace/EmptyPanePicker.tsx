import { type PaneContent, usePaneActions } from '@/contexts/TabContext';
import type { WorktreeOption } from './ToolPanes';

interface SessionInfo {
  channelId: string;
  title?: string;
  status?: 'idle' | 'busy';
  branch?: string;
  paneLabel?: string;
}

const TOOL_OPTIONS: { label: string; content: (cwd: string) => PaneContent }[] = [
  { label: '🌿 Git', content: (cwd) => ({ type: 'git', cwd }) },
  { label: '📁 Files', content: (cwd) => ({ type: 'files', cwd }) },
  { label: '📋 Spec', content: (cwd) => ({ type: 'spec', cwd }) },
  { label: '🌲 Worktrees', content: () => ({ type: 'worktrees' }) },
];

interface EmptyPanePickerProps {
  paneId: string;
  sessions?: SessionInfo[];
  cwd?: string;
  onOpenModal?: (paneId: string) => void;
  availableWorktrees?: WorktreeOption[];
  projects?: { cwd: string; name: string }[];
  onNewSession?: (cwd: string) => void;
}

export function EmptyPanePicker({
  paneId,
  sessions = [],
  cwd,
  onOpenModal,
  availableWorktrees,
  projects,
  onNewSession,
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
      <div className="flex flex-col gap-1 w-full max-w-xs">
        {sessions.length > 0 && (
          <div className="mb-1">
            <p className="text-xs text-muted-foreground px-1 mb-1">Sessions:</p>
            {sessions.map((s) => (
              <button
                key={s.channelId}
                type="button"
                onClick={() => handleSelect(s.channelId)}
                className="px-3 py-2 text-sm text-left rounded hover:bg-accent w-full flex items-center justify-between"
              >
                <span>
                  {s.status === 'busy' ? '●' : '○'}{' '}
                  {s.branch && <span className="font-mono opacity-60">⎇ {s.branch} · </span>}
                  {s.title ?? s.channelId}
                </span>
                {s.paneLabel && (
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    ({s.paneLabel})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div
          data-testid="tool-options"
          data-cwd={cwd ?? ''}
          className="flex flex-col gap-1 border-t border-border pt-2"
        >
          <p className="text-xs text-muted-foreground px-1 mb-1">── Tools ──</p>
          <div className="flex flex-wrap gap-1">
            {TOOL_OPTIONS.map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={() => {
                  setContentInPane(paneId, tool.content(cwd ?? ''));
                  focusPane(paneId);
                }}
                className="px-3 py-2 text-sm rounded hover:bg-accent text-muted-foreground border border-border"
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {availableWorktrees !== undefined && (
          <div
            data-testid="new-session-in-section"
            className="flex flex-col gap-1 border-t border-border pt-2"
          >
            <p className="text-xs text-muted-foreground px-1 mb-1">── New session in ──</p>
            {(projects ?? []).map((project) => {
              const wts = availableWorktrees.filter((wt) => wt.projectName === project.name);
              if (wts.length === 0) return null;
              return (
                <div key={project.cwd} className="flex flex-wrap items-center gap-1 px-1">
                  <span className="text-xs text-muted-foreground">{project.name}:</span>
                  {wts.map((wt) => (
                    <button
                      key={wt.path}
                      type="button"
                      onClick={() => onNewSession?.(wt.path)}
                      className="px-2 py-1 text-xs rounded hover:bg-accent text-muted-foreground border border-border"
                    >
                      + ⎇ {wt.branch ?? wt.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {onOpenModal && (
          <button
            type="button"
            onClick={() => onOpenModal(paneId)}
            className="px-3 py-2 text-sm text-left rounded hover:bg-accent text-muted-foreground mt-1 border-t border-border pt-2"
          >
            More options...
          </button>
        )}
      </div>
    </div>
  );
}
