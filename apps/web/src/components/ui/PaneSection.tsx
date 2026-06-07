import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { SectionLabel } from './SectionLabel.tsx';

interface PaneSectionProps {
  title: ReactNode;
  scope?: string;
  action?: ReactNode;
  bordered?: boolean;
  className?: string;
  children: ReactNode;
}

export function PaneSection({
  title,
  scope,
  action,
  bordered = false,
  className,
  children,
}: PaneSectionProps): React.JSX.Element {
  return (
    <div className={cn('px-3 py-2', bordered && 'border-b border-border', className)}>
      <SectionLabel as="h4" className="m-0 mb-1 flex items-baseline gap-1">
        <span>{title}</span>
        {scope && <span className="text-xs text-dim normal-case">({scope})</span>}
        {action && <span className="ml-auto">{action}</span>}
      </SectionLabel>
      {children}
    </div>
  );
}
