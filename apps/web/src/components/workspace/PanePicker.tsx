import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';

interface SessionInfo {
  channelId: string;
  title?: string;
  status?: 'idle' | 'busy';
  branch?: string;
  paneLabel?: string;
  cwd?: string;
}

export interface PastSessionInfo {
  id: string;
  channelId: string;
  title?: string;
  cwd?: string;
  createdAt: string;
}

interface WorktreeInfo {
  path: string;
  branch?: string;
  name: string;
}

interface ProjectInfo {
  cwd: string;
  name: string;
}

type ToolTabType = 'git' | 'files' | 'spec';

interface PanePickerProps {
  open: boolean;
  onClose: () => void;
  sessions?: SessionInfo[];
  pastSessions?: PastSessionInfo[];
  projects?: ProjectInfo[];
  allWorktrees?: Record<string, WorktreeInfo[]>;
  activeProjectCwd?: string;
  targetPaneId?: string;
  onShowHere?: (channelId: string, paneId?: string) => void;
  onResume?: (sessionId: string) => void;
  onNewSession?: (cwd: string, projectCwd: string, paneId?: string) => void;
  onOpenToolPane?: (type: ToolTabType, cwd: string, paneId?: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
  onAddProject?: () => void;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

interface SelectedWorktree {
  path: string;
  projectCwd: string;
}

function WorktreeTree({
  projects,
  allWorktrees,
  sessions,
  selected,
  onSelect,
  onNewWorktree,
  onAddProject,
}: {
  projects: ProjectInfo[];
  allWorktrees: Record<string, WorktreeInfo[]>;
  sessions: SessionInfo[];
  selected: SelectedWorktree | null;
  onSelect: (wt: SelectedWorktree) => void;
  onNewWorktree?: (projectCwd: string) => void;
  onAddProject?: () => void;
}) {
  return (
    <div
      data-testid="pane-picker-left"
      className="flex flex-col w-48 shrink-0 border-r border-border overflow-y-auto py-2"
    >
      {projects.map((project) => (
        <div key={project.cwd} className="mb-2">
          <p className="text-xs font-medium text-muted-foreground px-3 py-1">{project.name}</p>
          {(allWorktrees[project.cwd] ?? []).map((wt) => {
            const hasSession = sessions.some((s) => s.cwd === wt.path);
            const isSelected = selected?.path === wt.path;
            return (
              <button
                key={wt.path}
                type="button"
                data-has-session={hasSession ? 'true' : 'false'}
                onClick={() => onSelect({ path: wt.path, projectCwd: project.cwd })}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-1.5 ${
                  isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <span className={hasSession ? 'text-green-500' : 'text-muted-foreground'}>
                  {hasSession ? '●' : '○'}
                </span>
                <span className="font-mono truncate">⎇ {wt.branch ?? wt.name}</span>
              </button>
            );
          })}
          {onNewWorktree && (
            <button
              type="button"
              onClick={() => onNewWorktree(project.cwd)}
              className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50"
            >
              + New worktree
            </button>
          )}
        </div>
      ))}
      {onAddProject && (
        <button
          type="button"
          onClick={onAddProject}
          className="px-3 py-1.5 text-sm text-left text-muted-foreground hover:bg-accent/50 mt-auto"
        >
          + Add project
        </button>
      )}
    </div>
  );
}

function WorktreeContent({
  worktreePath,
  projectCwd,
  sessions,
  pastSessions,
  targetPaneId,
  onShowHere,
  onResume,
  onNewSession,
  onOpenToolPane,
}: {
  worktreePath: string;
  projectCwd: string;
  sessions: SessionInfo[];
  pastSessions: PastSessionInfo[];
  targetPaneId?: string;
  onShowHere?: (channelId: string, paneId?: string) => void;
  onResume?: (sessionId: string) => void;
  onNewSession?: (cwd: string, projectCwd: string, paneId?: string) => void;
  onOpenToolPane?: (type: ToolTabType, cwd: string, paneId?: string) => void;
}) {
  const activeSessions = sessions.filter((s) => s.cwd === worktreePath);
  const resumeSessions = pastSessions.filter((s) => s.cwd === worktreePath);

  return (
    <div data-testid="pane-picker-right" className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {activeSessions.length > 0 && (
        <section>
          <p className="text-xs text-muted-foreground mb-2">Active</p>
          <div className="flex flex-col gap-1">
            {activeSessions.map((s) => (
              <div
                key={s.channelId}
                data-testid={`modal-session-item-${s.channelId}`}
                className="flex items-center justify-between px-3 py-2 rounded hover:bg-accent"
              >
                <span className="text-sm">
                  {s.status === 'busy' ? '●' : '○'}{' '}
                  {s.branch && <span className="font-mono opacity-60">⎇ {s.branch} · </span>}
                  {s.title ?? s.channelId}
                  {s.paneLabel && (
                    <span className="text-xs text-muted-foreground ml-2">← {s.paneLabel}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onShowHere?.(s.channelId, targetPaneId)}
                  className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground ml-2 shrink-0"
                >
                  Show here
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {resumeSessions.length > 0 && (
        <section>
          <p className="text-xs text-muted-foreground mb-2">Resume</p>
          <div className="flex flex-col gap-1">
            {resumeSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2 rounded hover:bg-accent"
              >
                <span className="text-sm flex flex-col">
                  <span>{s.title ?? s.id}</span>
                  <span className="text-xs text-muted-foreground">{relativeTime(s.createdAt)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onResume?.(s.id)}
                  className="px-2 py-1 text-xs rounded hover:bg-accent border border-border ml-2 shrink-0"
                >
                  Resume
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onNewSession?.(worktreePath, projectCwd, targetPaneId)}
          className="px-3 py-2 text-sm text-left rounded hover:bg-accent"
        >
          + New session
        </button>
        <div className="flex gap-2">
          {(['git', 'files', 'spec'] as ToolTabType[]).map((type) => (
            <button
              key={type}
              type="button"
              data-tool={type}
              onClick={() => onOpenToolPane?.(type, worktreePath, targetPaneId)}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent capitalize"
            >
              {type === 'git' ? '🌿 Git' : type === 'files' ? '📁 Files' : '📋 Spec'}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PanePicker({
  open,
  onClose,
  sessions = [],
  pastSessions = [],
  projects = [],
  allWorktrees = {},
  activeProjectCwd,
  targetPaneId,
  onShowHere,
  onResume,
  onNewSession,
  onOpenToolPane,
  onNewWorktree,
  onAddProject,
}: PanePickerProps): React.JSX.Element {
  const defaultWorktree = (() => {
    const activeProject = projects.find((p) => p.cwd === activeProjectCwd) ?? projects[0];
    if (!activeProject) return null;
    const wt = allWorktrees[activeProject.cwd]?.[0];
    if (!wt) return null;
    return { path: wt.path, projectCwd: activeProject.cwd };
  })();

  const [userSelected, setUserSelected] = useState<SelectedWorktree | null>(null);
  const selected = userSelected ?? defaultWorktree;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Open in pane" size="fullscreen" scrollable={false}>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <WorktreeTree
            projects={projects}
            allWorktrees={allWorktrees}
            sessions={sessions}
            selected={selected}
            onSelect={setUserSelected}
            onNewWorktree={onNewWorktree}
            onAddProject={onAddProject}
          />
          {selected ? (
            <WorktreeContent
              worktreePath={selected.path}
              projectCwd={selected.projectCwd}
              sessions={sessions}
              pastSessions={pastSessions}
              targetPaneId={targetPaneId}
              onShowHere={onShowHere}
              onResume={onResume}
              onNewSession={onNewSession}
              onOpenToolPane={onOpenToolPane}
            />
          ) : (
            <div
              data-testid="pane-picker-right"
              className="flex-1 flex items-center justify-center text-muted-foreground text-sm"
            >
              Select a worktree
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
