import { Pane } from '../Pane.tsx';

export interface PaneToolbarCommonProps {
  paneId: string;
  isOnly?: boolean;
  branch?: string;
  title?: string;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onClose?: () => void;
  onSwap?: (targetId: string) => void;
}

/**
 * The single place that renders Pane + Pane.Toolbar for leaf bodies — toolbar
 * existence and common-prop wiring are guaranteed here, named pane components
 * only contribute the `tools` slot and the body (pane-tree D4).
 */
export function PaneShell({
  toolbarProps,
  tools,
  scrollable = true,
  children,
}: {
  toolbarProps: PaneToolbarCommonProps;
  tools?: React.ReactNode;
  /** false = body manages its own layout/scroll (session panes) */
  scrollable?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pane>
      <Pane.Toolbar {...toolbarProps}>{tools}</Pane.Toolbar>
      {scrollable ? <Pane.Content>{children}</Pane.Content> : children}
    </Pane>
  );
}
