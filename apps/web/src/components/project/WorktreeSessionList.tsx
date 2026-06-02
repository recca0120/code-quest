import type { SessionStateSummary } from '@code-quest/schemas';
import { useCallback, useMemo } from 'react';
import { useNavigationActions } from '@/contexts/NavigationContext';
import { useSession } from '@/contexts/SessionContext';
import { StatusDot } from '../ui/StatusDot.tsx';

function sessionDotProps(state: string): {
  color: 'accent' | 'success' | 'danger' | 'muted';
  pulse?: boolean;
} {
  if (state === 'busy' || state === 'processing' || state === 'connecting')
    return { color: 'accent', pulse: true };
  if (state === 'idle') return { color: 'success' };
  if (state === 'disconnected') return { color: 'danger' };
  return { color: 'muted' };
}

interface WorktreeSessionListProps {
  /** Path of the worktree this list is shown under. */
  worktreePath: string;
  /** Project root — used as cwd for requestActivateChannel (must match TabProvider's cwd). */
  projectCwd: string;
}

export function WorktreeSessionList({
  worktreePath,
  projectCwd,
}: WorktreeSessionListProps): React.JSX.Element | null {
  const { sessions, closeSession } = useSession();
  const { requestActivateChannel } = useNavigationActions();

  const worktreeSessions = useMemo(
    () => sessions.filter((s) => s.state !== 'exited' && (s.cwd ?? projectCwd) === worktreePath),
    [sessions, worktreePath, projectCwd],
  );

  const handleSelect = useCallback(
    (s: SessionStateSummary) => {
      // Use projectRoot (= TabProvider's cwd), not s.cwd (= worktree path).
      requestActivateChannel(s.projectRoot, s.channelId);
    },
    [requestActivateChannel],
  );

  const handleClose = useCallback(
    (channelId: string) => {
      closeSession(channelId);
      // TabProvider's sessions-diff effect handles removeTab automatically.
    },
    [closeSession],
  );

  if (worktreeSessions.length === 0) return null;

  return (
    <div className="ml-3 border-l border-border pl-2 flex flex-col">
      {worktreeSessions.map((s) => {
        const { color, pulse } = sessionDotProps(s.state);
        const label = s.title ?? s.channelId.slice(0, 8);
        return (
          <div
            key={s.channelId}
            className="group relative flex items-center gap-1.5 px-2 py-1 text-xs rounded text-muted hover:bg-hover-tint hover:text-text"
          >
            <button
              type="button"
              aria-label={`Session: ${label}`}
              onClick={() => handleSelect(s)}
              className="absolute inset-0"
            />
            <StatusDot color={color} pulse={pulse} className="relative z-10 shrink-0" />
            <span className="relative z-10 truncate flex-1">{label}</span>
            <button
              type="button"
              aria-label={`Close session: ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                handleClose(s.channelId);
              }}
              className="relative z-10 shrink-0 px-0.5 rounded text-subtle hover:text-danger opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
