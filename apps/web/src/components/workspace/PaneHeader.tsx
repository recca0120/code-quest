import { useState } from 'react';
import { usePaneState } from '@/contexts/TabContext';
import { useMobileMode } from './useMobileMode';

type ContextTool = 'files' | 'git' | 'spec';

interface PaneHeaderProps {
  paneId: string;
  branch?: string;
  title?: string;
  cwd?: string;
  isOnly?: boolean;
  activeTool?: ContextTool | null;
  onToolSelect?: (tool: ContextTool | null) => void;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onClose?: () => void;
  onSwap?: (targetId: string) => void;
}

export function PaneHeader({
  paneId,
  branch,
  title,
  cwd,
  isOnly = false,
  activeTool = null,
  onToolSelect,
  onSplitH,
  onSplitV,
  onClose,
  onSwap,
}: PaneHeaderProps): React.JSX.Element {
  const { focusedPaneId, zoomedPaneId } = usePaneState();
  const isFocused = focusedPaneId === paneId;
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
      className="flex items-center gap-1 px-2 py-1 text-xs border-b border-border data-[focused]:ring-1 data-[focused]:ring-primary"
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
        {cwd && (
          <>
            <button
              type="button"
              aria-label="Files"
              onClick={(e) => {
                e.stopPropagation();
                onToolSelect?.(activeTool === 'files' ? null : 'files');
              }}
              className="opacity-60 hover:opacity-100"
              title="Files"
            >
              📁
            </button>
            <button
              type="button"
              aria-label="Git"
              onClick={(e) => {
                e.stopPropagation();
                onToolSelect?.(activeTool === 'git' ? null : 'git');
              }}
              className="opacity-60 hover:opacity-100"
              title="Git"
            >
              🌿
            </button>
            <button
              type="button"
              aria-label="Spec"
              onClick={(e) => {
                e.stopPropagation();
                onToolSelect?.(activeTool === 'spec' ? null : 'spec');
              }}
              className="opacity-60 hover:opacity-100"
              title="Spec"
            >
              📋
            </button>
          </>
        )}
        {!isMobile && (
          <>
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
          className="opacity-60 hover:opacity-100 disabled:opacity-30"
          title="Close pane"
        >
          ×
        </button>
      </div>
    </div>
  );
}
