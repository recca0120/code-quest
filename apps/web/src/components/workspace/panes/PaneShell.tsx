import { Pane } from '../Pane.tsx';

export interface PaneToolbarCommonProps {
  paneId: string;
  isOnly?: boolean;
  branch?: string;
  title?: string;
  /** pane 類型 glyph（handoff §2）；session pane 傳 chat ✦ */
  typeIcon?: React.ReactNode;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onZoom?: () => void;
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
      {/* 非 focus dim 只作用於 body（handoff §2：header 不 dim）——
          PaneLeaf wrapper 掛 group/pane＋data-dimmed，這層容器收 dim */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 group-data-[dimmed]/pane:opacity-(--pane-dim-opacity)">
        {scrollable ? <Pane.Content>{children}</Pane.Content> : children}
      </div>
    </Pane>
  );
}
