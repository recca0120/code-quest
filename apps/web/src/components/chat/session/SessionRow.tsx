import type { Ack, SessionSummary } from '@code-quest/schemas';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { HighlightText } from '@/components/chat/ui/HighlightText';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';
import { formatRelativeDate } from '@/utils/format-relative-date';

interface SessionRowProps {
  session: SessionSummary;
  isFocused?: boolean;
  isActive?: boolean;
  onSelect: (id: string) => void;
  onMouseEnter?: () => void;
  onRename?: (id: string, title: string) => Promise<Ack>;
  onDelete?: (id: string) => Promise<Ack>;
  searchQuery?: string;
}

export function SessionRow({
  session: s,
  isFocused,
  isActive,
  onSelect,
  onMouseEnter,
  onRename,
  onDelete,
  searchQuery,
}: SessionRowProps): React.JSX.Element {
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
  };

  const finishRename = async () => {
    if (!isRenaming || !renameInputRef.current) return;
    const newTitle = renameInputRef.current.value.trim();
    setIsRenaming(false);
    if (newTitle && newTitle !== displayTitle && onRename) {
      const result = await onRename(s.channelId, newTitle);
      if (!result.ok) {
        toast.error(`Rename failed: ${result.error ?? 'Failed to rename'}`);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      renameInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsRenaming(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(s.channelId);
  };

  const displayTitle = s.title || s.firstUserMessage || 'Untitled';

  return (
    <div
      role="option"
      aria-selected={isFocused ?? false}
      tabIndex={0}
      className={cn(
        'flex items-center w-full text-left px-3 py-2 group',
        isActive ? 'bg-selected cursor-default' : 'hover:bg-hover-tint cursor-pointer',
        !isActive && isFocused && 'bg-hover-tint',
      )}
      onClick={isRenaming || isActive ? undefined : () => onSelect(s.channelId)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isRenaming && !isActive) onSelect(s.channelId);
      }}
      onMouseEnter={onMouseEnter}
    >
      {isRenaming ? (
        <input
          ref={renameInputRef}
          type="text"
          defaultValue={displayTitle}
          className="flex-1 text-sm text-text truncate outline-none border-b border-accent bg-transparent min-w-0"
          onKeyDown={handleKeyDown}
          onBlur={finishRename}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-sm text-text truncate">
          <HighlightText text={displayTitle} query={searchQuery} />
        </span>
      )}
      <span className="flex items-center gap-1 shrink-0 ml-2">
        <span className="text-xs text-muted">{formatRelativeDate(s.createdAt)}</span>
        {(onRename || onDelete) && (
          <span className="hidden group-hover:flex items-center gap-1">
            {onRename && (
              <IconButton
                title="Rename"
                onClick={handleRenameStart}
                className="text-muted hover:text-text"
              >
                ✏
              </IconButton>
            )}
            {onDelete && (
              <IconButton
                title="Delete"
                onClick={handleDelete}
                className="text-muted hover:text-danger"
              >
                🗑
              </IconButton>
            )}
          </span>
        )}
      </span>
    </div>
  );
}
