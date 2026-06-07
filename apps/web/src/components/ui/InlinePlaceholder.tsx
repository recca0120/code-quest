import type { ReactNode } from 'react';

export function InlinePlaceholder({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="text-muted text-xs px-1">{children}</div>;
}
