import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Icon } from '@iconify/react';
import { forwardRef, type HTMLAttributes, type MouseEvent } from 'react';
import { TextField } from '@/components/chat/ui/TextField';
import { cn } from '@/utils/cn';
import { getFileIcon } from '@/utils/getFileIcon';
import { gitStatusMark } from '@/utils/git-status';

interface EntryItem {
  name: string;
  path: string;
  kind: 'directory' | 'file';
}

interface RowRenameState {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

// `Item` is structurally typed against the headless-tree iterator API
// instead of importing the package's deeply-generic ItemInstance type —
// the methods we actually call form a small, stable subset.
interface RowItem {
  getId: () => string;
  getProps: () => Record<string, unknown> & { onClick?: (e: MouseEvent) => void };
  getItemMeta: () => { level: number };
  getItemData: () => EntryItem;
  getItemName: () => string;
  isExpanded: () => boolean;
}

/** Extends `HTMLAttributes` so Radix `ContextMenu.Trigger asChild` can
 *  forward its props (notably `onContextMenu`) onto the row's `<div>`. */
interface FileTreeRowProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick' | 'onDoubleClick'> {
  item: RowItem;
  isHighlighted: boolean;
  /** When true, render greyed-out + cursor-not-allowed. Click handlers
   *  remain wired (parent decides what to do); a11y exposed via aria-disabled. */
  isDisabled?: boolean;
  gitMark: string | undefined;
  rename: RowRenameState | null;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

/** Visual file/directory row. Stays tightly coupled to headless-tree's
 *  iteration locals (`item.getProps()` etc.) — that's the headless-tree
 *  contract, not an SRP issue. ContextMenu wrapping happens at the call
 *  site so this component doesn't carry menu props. */
export const FileTreeRow: React.ForwardRefExoticComponent<
  FileTreeRowProps & React.RefAttributes<HTMLDivElement>
> = forwardRef<HTMLDivElement, FileTreeRowProps>(function FileTreeRow(
  { item, isHighlighted, isDisabled, gitMark, rename, onClick, onDoubleClick, ...slotProps },
  ref,
) {
  const data = item.getItemData();
  const isFile = data.kind === 'file';
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: item.getProps() provides role + tabIndex
    // biome-ignore lint/a11y/useKeyWithClickEvents: headless-tree handles keyboard via getProps()
    <div
      {...item.getProps()}
      {...slotProps}
      ref={ref}
      aria-disabled={isDisabled || undefined}
      className={cn(
        'flex items-center pr-1 py-0.5 text-sm select-none pl-[calc(var(--depth)*0.875rem+0.375rem)]',
        isDisabled
          ? 'cursor-not-allowed opacity-40'
          : ['cursor-pointer', isHighlighted ? 'bg-accent/20' : 'hover:bg-hover-tint'],
      )}
      style={{ '--depth': item.getItemMeta().level } as React.CSSProperties}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span className="mr-1 inline-flex items-center">
        {isFile ? (
          <Icon icon={getFileIcon(item.getItemName())} className="w-4 h-4" />
        ) : (
          <>
            <ChevronRightIcon
              className={cn(
                'w-3.5 h-3.5 transition-transform duration-150',
                item.isExpanded() && 'rotate-90',
              )}
            />
            <Icon
              icon={
                item.isExpanded() ? 'material-icon-theme:folder-open' : 'material-icon-theme:folder'
              }
              className="w-4 h-4 ml-0.5"
            />
          </>
        )}
      </span>
      {rename ? (
        <TextField
          autoFocus
          size="sm"
          mono
          value={rename.value}
          onChange={rename.onChange}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') rename.onSubmit();
            if (e.key === 'Escape') rename.onCancel();
          }}
          onBlur={() => rename.onSubmit()}
          className="flex-1 border-accent"
        />
      ) : (
        <span className="flex-1 truncate">{item.getItemName()}</span>
      )}
      {isFile && gitMark && (
        <span
          role="status"
          aria-label={`git-mark-${data.path}`}
          className={cn(
            'ml-2 font-mono text-xs px-1 rounded bg-hover-tint',
            gitStatusMark(gitMark).cls,
          )}
        >
          {gitMark}
        </span>
      )}
    </div>
  );
});
