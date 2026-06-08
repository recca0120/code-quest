import { usePaneState } from '@/contexts/TabContext';

interface PaneHeaderProps {
  paneId: string;
  branch?: string;
  title?: string;
  isOnly?: boolean;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onClose?: () => void;
}

export function PaneHeader({
  paneId,
  branch,
  title,
  isOnly = false,
  onSplitH,
  onSplitV,
  onClose,
}: PaneHeaderProps): React.JSX.Element {
  const { focusedPaneId, zoomedPaneId } = usePaneState();
  const isFocused = focusedPaneId === paneId;
  const isZoomed = zoomedPaneId === paneId;

  return (
    <div
      data-testid="pane-header"
      data-focused={isFocused || undefined}
      className="flex items-center gap-1 px-2 py-1 text-xs border-b border-border"
    >
      {isZoomed && (
        <span data-testid="pane-zoomed-indicator" className="text-accent">
          ⊠ zoomed
        </span>
      )}
      {branch && <span className="text-muted-foreground">⎇ {branch}</span>}
      {branch && title && <span className="text-muted-foreground">·</span>}
      {title && <span className="font-medium truncate">{title}</span>}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          data-testid="pane-split-h"
          onClick={(e) => {
            e.stopPropagation();
            onSplitH?.();
          }}
          className="opacity-60 hover:opacity-100"
          title="Split horizontally"
        >
          ⊟
        </button>
        <button
          type="button"
          data-testid="pane-split-v"
          onClick={(e) => {
            e.stopPropagation();
            onSplitV?.();
          }}
          className="opacity-60 hover:opacity-100"
          title="Split vertically"
        >
          ⊞
        </button>
        <button
          type="button"
          data-testid="pane-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          disabled={isOnly}
          className="opacity-60 hover:opacity-100 disabled:opacity-30"
          title="Close pane"
        >
          ×
        </button>
      </div>
    </div>
  );
}
