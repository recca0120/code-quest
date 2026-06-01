import type { SessionStateSummary } from '@code-quest/schemas';
import { toast } from 'sonner';
import { StatusDot } from '@/components/ui/StatusDot';
import { basename } from '@/utils/basename';
import { LiveSessionPopover } from './LiveSessionPopover.tsx';

const MAX_VISIBLE = 5;

const LIVE_STATES = new Set(['busy', 'launching', 'idle']);

type DotColor = 'success' | 'warning' | 'muted' | 'danger';
const DOT_COLOR: Record<string, { color: DotColor; pulse?: boolean }> = {
  busy: { color: 'success', pulse: true },
  launching: { color: 'warning', pulse: true },
  idle: { color: 'muted' },
  exited: { color: 'muted' },
  disconnected: { color: 'danger' },
};

interface TopbarLiveSessionsProps {
  sessions: SessionStateSummary[];
  onActivate: (channelId: string) => void;
  onStop?: (channelId: string) => void;
  onSplit?: (channelId: string) => void;
}

export function TopbarLiveSessions({
  sessions,
  onActivate,
  onStop,
  onSplit,
}: TopbarLiveSessionsProps): React.JSX.Element {
  const live = sessions.filter((s) => LIVE_STATES.has(s.state));
  const visible = live.slice(0, MAX_VISIBLE);
  const overflow = live.length - visible.length;

  return (
    <section aria-label="topbar-live-sessions" className="flex items-center gap-1">
      {visible.map((s) => {
        const label = labelFor(s);
        return (
          <span key={s.channelId} className="group inline-flex items-center">
            <button
              type="button"
              aria-label={`${label} (${s.state})`}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-l border border-border text-xs text-muted hover:text-text hover:bg-hover-tint"
              onClick={() => onActivate(s.channelId)}
              title={s.title ?? label}
            >
              <StatusDot {...(DOT_COLOR[s.state] ?? { color: 'muted' })} />
              <span className="font-mono truncate max-w-32">{label}</span>
            </button>
            <LiveSessionPopover
              session={s}
              trigger={
                <button
                  type="button"
                  aria-label={`More actions for ${label}`}
                  className="px-1 py-0.5 rounded-r border border-l-0 border-border text-xs text-dim hover:text-text hover:bg-hover-tint opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  ⋯
                </button>
              }
              onOpen={onActivate}
              onStop={onStop ?? ((cid: string) => toast(`Stop ${cid} — coming soon`))}
              onSplit={onSplit ?? ((cid: string) => toast(`Split chat — coming soon (${cid})`))}
            />
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="px-1.5 py-0.5 rounded border border-border text-xs text-dim">
          +{overflow}
        </span>
      )}
    </section>
  );
}

function labelFor(s: SessionStateSummary): string {
  const proj = basename(s.projectRoot);
  if (!s.cwd || s.cwd === s.projectRoot) return proj;
  return `${proj}/${basename(s.cwd)}`;
}
