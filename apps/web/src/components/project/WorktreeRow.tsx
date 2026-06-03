import type { WorktreeInfo } from '@code-quest/git';
import type { ReactElement, ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { cn } from '@/utils/cn';
import { pluralize } from '@/utils/pluralize';

interface WorktreeRowProps {
  worktree: WorktreeInfo;
  active: boolean;
  liveSessions: number;
  /** Count of uncommitted changes (from `git status`). >0 triggers the warning dot. */
  changes: number;
  onSelect: () => void;
  /** Called when the [+] "Open new chat" button is clicked. */
  onOpenNewChat?: () => void;
  /** Called when the ⋯ "More actions" button is clicked (mobile: opens BottomSheet). */
  onMoreActions?: () => void;
  className?: string;
  /**
   * Parent-supplied wrapper that renders the branch badge as a Radix
   * trigger (e.g. `Popover.Trigger asChild`). When omitted, the badge is
   * a plain element.
   */
  wrapBranchTrigger?: (child: ReactElement) => ReactNode;
  /**
   * Parent-supplied wrapper that renders the ⋯ button as a Radix
   * trigger (e.g. `DropdownMenu.Trigger asChild`). Desktop only.
   * When omitted, the button calls `onMoreActions` directly.
   */
  wrapMoreTrigger?: (child: ReactElement) => ReactNode;
}

export function WorktreeRow({
  worktree,
  active,
  liveSessions,
  changes,
  onSelect,
  onOpenNewChat,
  onMoreActions,
  wrapBranchTrigger,
  wrapMoreTrigger,
  className,
}: WorktreeRowProps): React.JSX.Element {
  const label = worktree.branch ?? worktree.name;

  const moreBtn =
    onMoreActions || wrapMoreTrigger ? (
      <button
        type="button"
        aria-label="More actions"
        title="More"
        onClick={(e) => {
          e.stopPropagation();
          onMoreActions?.();
        }}
        className="relative z-10 shrink-0 px-1 text-muted hover:text-text lg:opacity-0 lg:group-hover:opacity-100"
      >
        ⋯
      </button>
    ) : null;

  const branchBadge = (
    <button
      type="button"
      aria-label={`Switch branch (currently ${label})`}
      onClick={(e) => {
        e.stopPropagation();
      }}
      className="relative z-10 inline-flex items-center gap-1 min-w-0 hover:text-text cursor-pointer font-mono text-xs text-muted"
      title={label}
    >
      <span aria-hidden="true" className="text-subtle text-xs shrink-0">
        ⎇
      </span>
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div
      className={cn(
        'group relative flex items-center gap-1.5 px-2 py-1 text-xs rounded border-l-2',
        active
          ? 'border-accent bg-hover-tint text-text'
          : 'border-transparent text-muted hover:bg-hover-tint hover:text-text',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Open worktree ${label}`}
        onClick={onSelect}
        className="absolute inset-0"
      />
      <span className="relative z-10 flex flex-1 items-center gap-1.5 min-w-0">
        {wrapBranchTrigger ? wrapBranchTrigger(branchBadge) : branchBadge}
      </span>
      {liveSessions > 0 && (
        <Badge
          variant="success"
          role="status"
          aria-label={pluralize(liveSessions, 'active session')}
          className="relative z-10 gap-1 bg-success/20"
        >
          <StatusDot color="success" pulse />
          {liveSessions}
        </Badge>
      )}
      {changes > 0 && (
        <StatusDot
          color="warning"
          className="relative z-10 w-2 h-2"
          role="status"
          aria-label={pluralize(changes, 'change')}
          title={pluralize(changes, 'change')}
        />
      )}
      {onOpenNewChat && (
        <button
          type="button"
          aria-label="Open new chat"
          title="Open new chat"
          onClick={(e) => {
            e.stopPropagation();
            onOpenNewChat();
          }}
          className="relative z-10 shrink-0 px-1 text-muted hover:text-text lg:opacity-0 lg:group-hover:opacity-100"
        >
          +
        </button>
      )}
      {moreBtn && (wrapMoreTrigger ? wrapMoreTrigger(moreBtn) : moreBtn)}
    </div>
  );
}
