import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'default' | 'muted' | 'accent' | 'danger' | 'success';

interface InlineActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: Variant;
  children: ReactNode;
}

const BASE = 'text-xs cursor-pointer transition-all';

const VARIANTS: Record<Variant, string> = {
  default: 'text-muted hover:text-accent',
  muted: 'text-muted hover:text-text',
  accent: 'text-accent hover:text-accent/80',
  danger: 'text-danger hover:text-danger/80',
  success: 'text-success hover:text-success/80',
};

export function InlineAction({
  variant = 'default',
  className,
  children,
  ...rest
}: InlineActionProps): React.JSX.Element {
  return (
    <button type="button" className={cn(BASE, VARIANTS[variant], className)} {...rest}>
      {children}
    </button>
  );
}
