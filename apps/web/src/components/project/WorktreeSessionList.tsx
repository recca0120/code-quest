import type { SessionBroadcastState } from '@code-quest/schemas';
import { useMemo } from 'react';
import { useNavigationActions } from '@/contexts/NavigationContext';
import { useSession } from '@/contexts/SessionContext';
import { ClickableRowOverlay } from '../ui/ClickableRowOverlay.tsx';
import { RowActionButton } from '../ui/RowActionButton.tsx';
import { StatusDot } from '../ui/StatusDot.tsx';

type DotProps = { color: 'accent' | 'success' | 'danger' | 'muted'; pulse?: boolean };
const DOT_BY_STATE: Partial<Record<SessionBroadcastState, DotProps>> = {
  busy: { color: 'accent', pulse: true },
  launching: { color: 'accent', pulse: true },
  idle: { color: 'success' },
  disconnected: { color: 'danger' },
};
const DEFAULT_DOT: DotProps = { color: 'muted' };

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

  if (worktreeSessions.length === 0) return null;

  return (
    <div className="ml-3 border-l border-border pl-2 flex flex-col">
      {worktreeSessions.map((s) => {
        const { color, pulse } = DOT_BY_STATE[s.state] ?? DEFAULT_DOT;
        const label = s.title ?? s.channelId.slice(0, 8);
        return (
          <div
            key={s.channelId}
            className="group relative flex items-center gap-1.5 px-2 py-1 text-xs rounded text-muted hover:bg-hover-tint hover:text-text"
          >
            <ClickableRowOverlay
              aria-label={`Session: ${label}`}
              onClick={() => requestActivateChannel(s.channelId)}
            />
            <StatusDot color={color} pulse={pulse} className="relative z-10 shrink-0" />
            <span className="relative z-10 truncate flex-1">{label}</span>
            <RowActionButton
              aria-label={`Close session: ${label}`}
              onClick={() => closeSession(s.channelId)}
              className="px-0.5 rounded text-subtle hover:text-danger opacity-0 group-hover:opacity-100"
            >
              ×
            </RowActionButton>
          </div>
        );
      })}
    </div>
  );
}
