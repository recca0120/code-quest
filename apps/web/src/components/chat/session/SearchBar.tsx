import type { Ref } from 'react';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  onToggleRaw?: () => void;
  rawActive?: boolean;
  placeholder?: string;
}

export function SearchBar({
  searchQuery,
  setSearchQuery,
  inputRef,
  onToggleRaw,
  rawActive = false,
  placeholder = 'Search messages...',
}: SearchBarProps): React.JSX.Element {
  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
        />
        {searchQuery && (
          <InlineAction aria-label="Clear search" onClick={() => setSearchQuery('')}>
            ✕
          </InlineAction>
        )}
        {onToggleRaw && (
          <Button
            variant="ghost"
            size="xs"
            aria-label="Toggle Raw Events"
            data-active={String(rawActive)}
            className={cn('font-medium px-1.5 py-0.5', rawActive && 'text-accent bg-accent/10')}
            onClick={onToggleRaw}
          >
            Raw
          </Button>
        )}
      </div>
    </div>
  );
}
