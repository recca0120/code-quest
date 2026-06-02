import type { SessionStateSummary } from '@code-quest/schemas';
import { Bars3Icon, Cog6ToothIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { TopbarLiveSessions } from '../live-session/TopbarLiveSessions.tsx';
import { IconButton } from '../ui/IconButton.tsx';

const topbarBtnClass = 'w-8 h-8 text-muted hover:text-text hover:bg-hover-tint';

type Mode = 'desktop' | 'mobile';

interface Props {
  mode: Mode;
  onOpenSettings: () => void;
  /** Toggle the left sidebar — desktop: collapse/expand Panel; tablet/mobile: open drawer. */
  onToggleLeft?: () => void;
  /** Open the command palette / search. */
  onOpenSearch?: () => void;
  /** The rest of the topbar contents (currently the TopScopeSwitcher). */
  children?: ReactNode;
  /** Live sessions for the inline pill list. */
  sessions?: SessionStateSummary[];
  /** Activate a live session by its channelId. */
  onActivateSession?: (channelId: string) => void;
}

const ROOT_CLASS: Record<Mode, string> = {
  desktop: 'flex items-center h-11 px-2 border-b border-border bg-surface shrink-0',
  mobile: 'flex items-center gap-2 h-11 px-3 border-b border-border bg-surface shrink-0',
};

function Brand() {
  return (
    <span className="hidden md:inline-flex items-center gap-1.5 px-2 mr-1 text-sm font-semibold text-text">
      <span className="text-accent text-base leading-none">✦</span>
      <span className="font-mono text-xs tracking-wide">code-quest</span>
    </span>
  );
}

export function WorkspaceTopbar({
  mode,
  onOpenSettings,
  onToggleLeft,
  onOpenSearch,
  children,
  sessions,
  onActivateSession,
}: Props): React.JSX.Element {
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: <header> has implicit banner role which supports aria-label
    <header aria-label={`${mode}-topbar`} className={ROOT_CLASS[mode]}>
      <Brand />
      {onToggleLeft && (
        <IconButton
          variant="plain"
          aria-label="Toggle sidebar"
          onClick={onToggleLeft}
          className={topbarBtnClass}
        >
          <Bars3Icon className="w-5 h-5" />
        </IconButton>
      )}
      {children}
      {sessions && onActivateSession && (
        <div className="ml-3">
          <TopbarLiveSessions sessions={sessions} onActivate={onActivateSession} />
        </div>
      )}
      {onOpenSearch && (
        <IconButton
          variant="plain"
          aria-label="Search"
          onClick={onOpenSearch}
          className={cn('ml-auto', topbarBtnClass)}
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
        </IconButton>
      )}
      <IconButton
        variant="plain"
        aria-label="Settings"
        onClick={onOpenSettings}
        className={cn(!onOpenSearch && 'ml-auto', topbarBtnClass)}
      >
        <Cog6ToothIcon className="w-5 h-5" />
      </IconButton>
    </header>
  );
}
