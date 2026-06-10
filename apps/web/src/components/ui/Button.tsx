import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { controlBorder, focusRing } from './_tokens.ts';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'info';
type Size = 'xs' | 'sm' | 'md';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: Variant;
  size?: Size;
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
}

const BASE = cn(
  'rounded cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed',
  focusRing,
);

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-selected-text hover:bg-accent/80',
  secondary: cn(controlBorder, 'text-muted hover:text-text hover:tint-5'),
  danger: 'bg-danger text-selected-text hover:bg-danger/80',
  ghost: 'text-muted hover:text-text hover:tint-5',
  success: 'bg-success text-selected-text hover:bg-success/80',
  warning: 'bg-warning text-selected-text hover:bg-warning/80',
  info: 'bg-info text-selected-text hover:bg-info/80',
};

const SIZES: Record<Size, string> = {
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-1.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'sm',
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button type={type} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  );
}
