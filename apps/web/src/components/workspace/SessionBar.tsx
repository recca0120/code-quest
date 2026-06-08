import { type PaneNode, usePaneActions, usePaneState } from '@/contexts/TabContext';
import type { SessionStatus } from '@/types/ui';

interface SessionInfo {
  channelId: string;
  title?: string;
  tabStatus?: SessionStatus;
  branch?: string;
}

interface SessionBarProps {
  sessions: SessionInfo[];
  onNewSession?: () => void;
  onCloseSession?: (channelId: string) => void;
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
  if (first !== 'inactive') return first;
  return getSessionStatusInTree(node.second, channelId, focusedPaneId);
}

const BUSY_STATUSES: Set<SessionStatus> = new Set(['processing', 'busy', 'cancelling']);

export function SessionBar({
  sessions,
  onNewSession,
  onCloseSession,
}: SessionBarProps): React.JSX.Element {
  const { paneRoot, focusedPaneId } = usePaneState();
  const { setSessionInPane, focusPane } = usePaneActions();

  function handleSessionClick(channelId: string) {
    function findFocusedLeaf(node: PaneNode): string | null {
      if (node.type === 'leaf') return focusedPaneId === node.id ? node.id : null;
      return findFocusedLeaf(node.first) ?? findFocusedLeaf(node.second);
    }
    function findFirstLeaf(node: PaneNode): string | null {
      if (node.type === 'leaf') return node.id;
      return findFirstLeaf(node.first) ?? findFirstLeaf(node.second);
    }
    const targetId = findFocusedLeaf(paneRoot) ?? findFirstLeaf(paneRoot);
    if (targetId) {
      setSessionInPane(targetId, channelId);
      focusPane(targetId);
    }
  }

  return (
    <div
      data-testid="session-bar"
      className="flex gap-1 p-1 border-b border-border overflow-x-auto"
    >
      {sessions.map((session) => {
        const itemStatus = getSessionStatusInTree(paneRoot, session.channelId, focusedPaneId);
        const isBusy = session.tabStatus ? BUSY_STATUSES.has(session.tabStatus) : false;
        const label = session.title ?? session.channelId;
        return (
          <div
            key={session.channelId}
            data-testid={`session-bar-item-${session.channelId}`}
            data-status={itemStatus}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded"
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
      {onNewSession && (
        <button
          type="button"
          aria-label="New tab"
          onClick={onNewSession}
          className="px-2 py-1 text-xs rounded opacity-60 hover:opacity-100 shrink-0"
        >
          +
        </button>
      )}
    </div>
  );
}
