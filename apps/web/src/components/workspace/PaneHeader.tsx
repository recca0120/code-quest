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
  onSplitH,
  onSplitV,
  onClose,
  onSwap,
}: PaneHeaderProps): React.JSX.Element {
  const { focusedPaneId, zoomedPaneId } = usePaneState();
  const isFocused = focusedPaneId === paneId;
  const isZoomed = zoomedPaneId === paneId;
  const isMobile = useMobileMode();
  const [activeTool, setActiveTool] = useState<ContextTool | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function toggleTool(tool: ContextTool): void {
    setActiveTool((prev) => (prev === tool ? null : tool));
  }

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
    <>
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
                  toggleTool('files');
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
                  toggleTool('git');
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
                  toggleTool('spec');
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
      {activeTool && cwd && (
        <div
          data-testid="context-panel"
          data-active-tool={activeTool}
          data-cwd={cwd}
          className="flex flex-col border-b border-border"
        >
          <div className="flex gap-1 px-2 py-1 border-b border-border">
            {(['files', 'git', 'spec'] as ContextTool[]).map((tool) => (
              <button
                key={tool}
                type="button"
                data-testid={`context-tab-${tool}`}
                aria-label={tool.charAt(0).toUpperCase() + tool.slice(1)}
                onClick={() => setActiveTool(tool)}
                data-active={activeTool === tool || undefined}
                className="px-2 py-0.5 text-xs rounded capitalize"
              >
                {tool}
              </button>
            ))}
          </div>
          <div className="p-2 text-xs text-muted-foreground">
            {activeTool} — {cwd}
          </div>
        </div>
      )}
    </>
  );
}
