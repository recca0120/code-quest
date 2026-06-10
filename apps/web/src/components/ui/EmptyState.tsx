import type { ReactNode } from 'react';
import { Button } from './Button.tsx';

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  hint?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  'data-testid'?: string;
}

export function EmptyState({
  icon,
  message,
  hint,
  actionLabel,
  onAction,
  'data-testid': testId,
}: EmptyStateProps): React.JSX.Element {
  const hasAction = actionLabel !== undefined && onAction !== undefined;
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center justify-center flex-1 gap-4 text-muted text-center px-6"
    >
      {icon && <span className="text-subtle">{icon}</span>}
      <p className="max-w-xs text-sm">{message}</p>
      {hint && <div className="text-xs text-dim">{hint}</div>}
      {hasAction && (
        <Button variant="primary" size="md" className="px-6 py-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
