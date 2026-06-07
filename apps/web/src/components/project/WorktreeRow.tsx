import type { WorktreeInfo } from '@code-quest/git';
import type { ReactElement, ReactNode } from 'react';
import { ClickableRowOverlay } from '@/components/ui/ClickableRowOverlay';
import { RowActionButton } from '@/components/ui/RowActionButton';
import { StatusDot } from '@/components/ui/StatusDot';
import { cn } from '@/utils/cn';
import { pluralize } from '@/utils/pluralize';

interface WorktreeRowProps {
  worktree: WorktreeInfo;
  active: boolean;
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
      <RowActionButton aria-label="More actions" title="More" onClick={onMoreActions} showOnHover>
        ⋯
      </RowActionButton>
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
      <ClickableRowOverlay aria-label={`Open worktree ${label}`} onClick={onSelect} />
      <span className="relative z-10 flex flex-1 items-center gap-1.5 min-w-0">
        {wrapBranchTrigger ? wrapBranchTrigger(branchBadge) : branchBadge}
      </span>
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
        <RowActionButton
          aria-label="Open new chat"
          title="Open new chat"
          onClick={onOpenNewChat}
          showOnHover
        >
          +
        </RowActionButton>
      )}
      {moreBtn && (wrapMoreTrigger ? wrapMoreTrigger(moreBtn) : moreBtn)}
    </div>
  );
}
