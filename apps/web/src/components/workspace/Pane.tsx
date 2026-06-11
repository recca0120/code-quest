import { ViewColumnsIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { leafIdsInOrder, usePaneState } from '@/contexts/TabContext';
import { cn } from '@/utils/cn';
import { useMobileMode } from './useMobileMode';

interface ToolbarProps {
  paneId: string;
  branch?: string;
  title?: string;
  cwd?: string;
  isOnly?: boolean;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onClose?: () => void;
  onSwap?: (targetId: string) => void;
  children?: React.ReactNode;
}

const TOOL_BTN =
  'w-6 h-6 flex items-center justify-center rounded hover:bg-hover-tint transition-colors';

function Toolbar({
  paneId,
  branch,
  title,
  isOnly = false,
  onSplitH,
  onSplitV,
  onClose,
  onSwap,
  children,
}: ToolbarProps): React.JSX.Element {
  const { paneRoot, focusedPaneId, zoomedPaneId } = usePaneState();
  const isFocused = focusedPaneId === paneId;
  const paneIndex = leafIdsInOrder(paneRoot).indexOf(paneId);
  const isZoomed = zoomedPaneId === paneId;
  const isMobile = useMobileMode();
  const [isDragging, setIsDragging] = useState(false);

  function handleDragStart(e: React.DragEvent) {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', paneId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== paneId && onSwap) {
      onSwap(sourceId);
    }
  }

  return (
    <div
      role="toolbar"
      data-testid="pane-header"
      data-focused={isFocused || undefined}
      data-dragging={isDragging || undefined}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex items-center gap-1 px-2 text-xs border-b border-border h-(--pane-header-h) shrink-0"
    >
      {paneIndex >= 0 && (
        <span
          data-testid="pane-index-badge"
          data-focused={isFocused || undefined}
          aria-hidden="true"
          className={`flex items-center justify-center size-4 rounded-(--radius-chip) font-mono text-2xs font-bold shrink-0 ${
            isFocused ? 'bg-accent text-selected-text' : 'bg-surface-hover text-subtle'
          }`}
        >
          {paneIndex + 1}
        </span>
      )}
      {isZoomed && (
        <span data-testid="pane-zoomed-indicator" className="text-accent">
          ⊠ zoomed
        </span>
      )}
      {branch && <span className="text-muted">⎇ {branch}</span>}
      {branch && title && <span className="text-muted">·</span>}
      {title && <span className="font-medium truncate">{title}</span>}
      {children && <div className="flex items-center gap-1 ml-1">{children}</div>}
      <div className="ml-auto flex items-center gap-0.5">
        {!isMobile && (
          <>
            <button
              type="button"
              data-testid="pane-split-h"
              onClick={(e) => {
                e.stopPropagation();
                onSplitH?.();
              }}
              className={cn(TOOL_BTN, 'text-muted hover:text-text')}
              title="Split horizontally"
            >
              <ViewColumnsIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="pane-split-v"
              onClick={(e) => {
                e.stopPropagation();
                onSplitV?.();
              }}
              className={cn(TOOL_BTN, 'text-muted hover:text-text rotate-90')}
              title="Split vertically"
            >
              <ViewColumnsIcon className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          data-testid="pane-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          disabled={isOnly}
          className={cn(TOOL_BTN, 'text-muted hover:text-text disabled:opacity-30')}
          title="Close pane"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function Content({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex-1 overflow-auto min-h-0">{children}</div>;
}

type PaneComponent = ((props: { children: React.ReactNode }) => React.JSX.Element) & {
  Toolbar: typeof Toolbar;
  Content: typeof Content;
};

export const Pane: PaneComponent = Object.assign(
  function Pane({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <div className="flex flex-col flex-1 min-w-0 min-h-0">{children}</div>;
  },
  { Toolbar, Content },
);
