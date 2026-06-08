import { Bars3Icon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { IconButton } from '../ui/IconButton.tsx';

interface ChatBreadcrumbProps {
  projectName?: string;
  branch?: string;
  sessionTitle?: string;
  onToggleLeft?: () => void;
  /** Slot for inline action buttons (e.g. ResumeButton) rendered inside the bar. */
  actions?: ReactNode;
}

const BTN_CLASS = 'w-7 h-7 text-muted hover:text-text hover:bg-hover-tint';

export function ChatBreadcrumb({
  projectName,
  branch,
  sessionTitle,
  onToggleLeft,
  actions,
}: ChatBreadcrumbProps): React.JSX.Element {
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: header has implicit banner role; aria-label needed for test queries
    <header
      aria-label="chat-breadcrumb"
      className="flex items-center gap-1 px-2 h-11 bg-surface border-b border-border text-xs shrink-0"
    >
      {onToggleLeft && (
        <IconButton
          variant="plain"
          aria-label="Toggle left sidebar"
          onClick={onToggleLeft}
          className={BTN_CLASS}
        >
          <Bars3Icon className="w-4 h-4" />
        </IconButton>
      )}
      <div className="flex items-center gap-1 flex-1 min-w-0 px-1 text-subtle">
        {projectName && <span className="shrink-0">{projectName}</span>}
        {branch && (
          <>
            <span className="shrink-0 text-dim">/</span>
            <span className="shrink-0 font-mono">⎇ {branch}</span>
          </>
        )}
        {sessionTitle && (
          <>
            <span className="shrink-0 text-dim">/</span>
            <span className="truncate text-text">{sessionTitle}</span>
          </>
        )}
      </div>
      {actions}
    </header>
  );
}
