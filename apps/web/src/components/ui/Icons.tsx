/**
 * Project-specific icon names mapped to heroicons.
 * Callers use these aliases so icon swaps stay in one place.
 * Sizes: callers set via className (e.g., "w-4 h-4"). Heroicons default is 24×24.
 */
export {
  ArrowPathIcon as RefreshIcon,
  CheckIcon as CheckMark,
  ChevronDownIcon as ChevronDown,
  ChevronRightIcon as ChevronRight,
  MagnifyingGlassIcon as SearchIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon as XIcon,
} from '@heroicons/react/24/outline';

import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

/** Slash-command menu icon (rounded square with diagonal slash). Drawn in
 *  heroicons outline style so it sits next to other icons consistently. */
export function SlashCommandIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
      className={className}
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path strokeLinecap="round" d="M14 8l-4 8" />
    </svg>
  );
}

export function RotatableChevron({
  open,
  className,
}: {
  open?: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className={cn('w-4 h-4 transition-transform', open && 'rotate-90', className)}
    />
  );
}

export function BorderedIconButton({
  onClick,
  label,
  danger,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded border border-border transition-colors disabled:opacity-40',
        danger ? 'text-muted hover:text-danger hover:border-danger' : 'text-subtle hover:text-text',
      )}
    >
      {children}
    </button>
  );
}
