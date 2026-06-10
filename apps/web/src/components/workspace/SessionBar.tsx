import { useState } from 'react';
import {
  findPaneBySession,
  firstLeafId,
  type PaneNode,
  usePaneActions,
  usePaneState,
} from '@/contexts/TabContext';
import type { SessionStatus } from '@/types/ui';
import { cn } from '@/utils/cn';
import type { WorktreeOption } from './ToolPanes.tsx';

interface SessionInfo {
  channelId: string;
  title?: string;
  tabStatus?: SessionStatus;
  branch?: string;
  cwd?: string | null;
}

interface ProjectInfo {
  cwd: string;
  name: string;
}

interface SessionBarProps {
  sessions: SessionInfo[];
  onCloseSession?: (channelId: string) => void;
  maxVisible?: number;
  onOpenModal?: () => void;
  availableWorktrees?: WorktreeOption[];
  projects?: ProjectInfo[];
  onNewSession?: (cwd: string, projectCwd?: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
}

function getSessionStatusInTree(
  node: PaneNode,
  channelId: string,
  focusedPaneId: string | null,
): 'focused-active' | 'active' | 'inactive' {
  if (node.type === 'leaf') {
    if (node.content.type === 'session' && node.content.sessionId === channelId) {
      return node.id === focusedPaneId ? 'focused-active' : 'active';
    }
    return 'inactive';
  }
  const first = getSessionStatusInTree(node.first, channelId, focusedPaneId);
  if (first === 'focused-active') return first;
  const second = getSessionStatusInTree(node.second, channelId, focusedPaneId);
  if (second === 'focused-active') return second;
  if (first === 'active' || second === 'active') return 'active';
  return 'inactive';
}

const BUSY_STATUSES: Set<SessionStatus> = new Set(['processing', 'busy', 'cancelling']);

export function SessionBar({
  sessions,
  onCloseSession,
  maxVisible,
  onOpenModal,
  availableWorktrees,
  projects,
  onNewSession,
  onNewWorktree,
}: SessionBarProps): React.JSX.Element {
  const { paneRoot, focusedPaneId } = usePaneState();
  const { setSessionInPane, focusPane } = usePaneActions();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [newSessionDropdownOpen, setNewSessionDropdownOpen] = useState(false);

  const visibleSessions = maxVisible != null ? sessions.slice(0, maxVisible) : sessions;
  const overflowSessions = maxVisible != null ? sessions.slice(maxVisible) : [];

  function handleSessionClick(channelId: string) {
    const existingPaneId = findPaneBySession(paneRoot, channelId);
    if (existingPaneId) {
      focusPane(existingPaneId);
      return;
    }
    const targetId = focusedPaneId ?? firstLeafId(paneRoot);
    if (targetId) {
      const session = sessions.find((s) => s.channelId === channelId);
      setSessionInPane(targetId, channelId, session?.cwd ?? null);
      focusPane(targetId);
    }
  }

  return (
    <div
      data-testid="session-bar"
      className="flex gap-1 p-1 border-b border-border overflow-x-auto"
    >
      {visibleSessions.map((session) => {
        const itemStatus = getSessionStatusInTree(paneRoot, session.channelId, focusedPaneId);
        const isBusy = !!session.tabStatus && BUSY_STATUSES.has(session.tabStatus);
        const label = session.title ?? session.channelId;
        return (
          <div
            key={session.channelId}
            data-testid={`session-bar-item-${session.channelId}`}
            data-status={itemStatus}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs rounded',
              itemStatus === 'focused-active' &&
                'bg-accent text-accent-foreground ring-1 ring-primary',
              itemStatus === 'active' && 'bg-muted',
              itemStatus === 'inactive' && 'opacity-60',
            )}
          >
            <span data-busy={isBusy || undefined} className="shrink-0">
              {isBusy ? '●' : '○'}
            </span>
            {session.branch && (
              <span data-branch="" className="font-mono opacity-60 shrink-0">
                ⎇ {session.branch}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleSessionClick(session.channelId)}
              className="truncate max-w-24"
            >
              {label}
            </button>
            {onCloseSession && (
              <button
                type="button"
                aria-label={`Close ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseSession(session.channelId);
                }}
                className="ml-0.5 opacity-50 hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      {overflowSessions.length > 0 && (
        <div className="relative">
          <button
            type="button"
            aria-label={`»${overflowSessions.length}`}
            onClick={() => setOverflowOpen((v) => !v)}
            className="px-2 py-1 text-xs rounded opacity-60 hover:opacity-100 shrink-0"
          >
            »{overflowSessions.length}
          </button>
          {overflowOpen && (
            <div
              data-testid="overflow-menu"
              className="absolute top-full left-0 z-50 bg-popover border border-border rounded shadow-md py-1 min-w-32"
            >
              {overflowSessions.map((session) => (
                <button
                  key={session.channelId}
                  type="button"
                  aria-label={session.title ?? session.channelId}
                  onClick={() => {
                    handleSessionClick(session.channelId);
                    setOverflowOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent"
                >
                  {session.title ?? session.channelId}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {availableWorktrees !== undefined && (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="New session"
            onClick={() => setNewSessionDropdownOpen((v) => !v)}
            className="px-2 py-1 text-xs rounded opacity-60 hover:opacity-100"
          >
            +
          </button>
          {newSessionDropdownOpen && (
            <div
              data-testid="new-session-dropdown"
              className="absolute top-full left-0 z-50 bg-popover border border-border rounded shadow-md py-1 min-w-48"
            >
              {(projects ?? []).map((project) => {
                const wts = availableWorktrees.filter((wt) => wt.projectName === project.name);
                return (
                  <div key={project.cwd}>
                    <p className="px-3 py-1 text-xs font-medium opacity-60">{project.name}</p>
                    {wts.map((wt) => (
                      <button
                        key={wt.path}
                        type="button"
                        onClick={() => {
                          onNewSession?.(wt.path, project.cwd);
                          setNewSessionDropdownOpen(false);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent font-mono"
                      >
                        ⎇ {wt.branch ?? wt.name}
                      </button>
                    ))}
                    {onNewWorktree && (
                      <button
                        type="button"
                        onClick={() => {
                          onNewWorktree(project.cwd);
                          setNewSessionDropdownOpen(false);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent text-muted-foreground"
                      >
                        + New worktree
                      </button>
                    )}
                  </div>
                );
              })}
              {availableWorktrees.length === 0 && (projects ?? []).length === 0 && (
                <p className="px-3 py-1.5 text-xs text-muted-foreground">No worktrees</p>
              )}
            </div>
          )}
        </div>
      )}
      {!availableWorktrees && onOpenModal && (
        <button
          type="button"
          aria-label="New tab"
          onClick={onOpenModal}
          className="px-2 py-1 text-xs rounded opacity-60 hover:opacity-100 shrink-0"
        >
          +
        </button>
      )}
    </div>
  );
}
