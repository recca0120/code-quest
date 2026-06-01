import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type GhostAddButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function GhostAddButton({
  className,
  children,
  ...rest
}: GhostAddButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'text-xs rounded border border-dashed border-border',
        'text-muted hover:text-text hover:border-accent',
        'transition-colors cursor-pointer',
        className,
      )}
    >
      {children}
    </button>
  );
}
