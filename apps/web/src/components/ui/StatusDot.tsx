import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type DotColor = 'success' | 'warning' | 'danger' | 'accent' | 'muted';

interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  color?: DotColor;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const colorClass: Record<DotColor, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-accent',
  muted: 'bg-text-dim',
};

const sizeClass = {
  sm: 'w-1 h-1',
  md: 'w-1.5 h-1.5',
};

export function StatusDot({
  color = 'muted',
  pulse = false,
  size = 'md',
  className,
  ...rest
}: StatusDotProps): React.JSX.Element {
  return (
    <span
      {...rest}
      className={cn(
        'rounded-full shrink-0',
        sizeClass[size],
        colorClass[color],
        pulse && 'animate-pulse',
        className,
      )}
    />
  );
}
