import type { ReactNode, RefObject } from 'react';
import { cn } from '@/utils/cn';
import { SearchIcon } from './Icons.tsx';

interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  trailing?: ReactNode;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  className?: string;
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel = 'Search',
  inputRef,
  trailing,
  onKeyDown,
  className,
}: SearchFieldProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-3 h-13 px-4 border-b border-floating-border-subtle',
        className,
      )}
    >
      <SearchIcon className="w-4 h-4 text-accent" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="flex-1 bg-transparent border-none outline-none text-base font-mono text-bright"
      />
      {trailing}
    </div>
  );
}
