import type { ReactNode } from 'react';

/** Thin sticky footer at the bottom of a right-pane scroll area, rendering
 *  a brief mono summary of the loaded content. Solves the "view has no end"
 *  feeling when content is sparse. Caller composes whatever items it wants
 *  (children); divider styling and base typography are shared. */
export function PaneStatusFooter({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="pane-status-footer"
      className="shrink-0 border-t border-border px-3 py-1.5 text-2xs font-mono text-dim flex items-center gap-2"
    >
      {children}
    </div>
  );
}
