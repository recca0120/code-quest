import {
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ViewColumnsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { usePaneState } from '@/contexts/TabContext';
import { cn } from '@/utils/cn';
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

const TOOL_BTN =
  'w-6 h-6 flex items-center justify-center rounded hover:bg-hover-tint transition-colors';

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
      <div className="ml-auto flex items-center gap-0.5">
        {cwd && (
          <>
            <button
              type="button"
              aria-label="Files"
              onClick={(e) => {
                e.stopPropagation();
                onToolSelect?.(activeTool === 'files' ? null : 'files');
              }}
              className={cn(
                TOOL_BTN,
                activeTool === 'files' ? 'text-primary' : 'text-muted hover:text-text',
              )}
              title="Files"
            >
              <DocumentTextIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Git"
              onClick={(e) => {
                e.stopPropagation();
                onToolSelect?.(activeTool === 'git' ? null : 'git');
              }}
              className={cn(
                TOOL_BTN,
                activeTool === 'git' ? 'text-primary' : 'text-muted hover:text-text',
              )}
              title="Git"
            >
              <span aria-hidden className="font-mono text-xs leading-none">
                ⎇
              </span>
            </button>
            <button
              type="button"
              aria-label="Spec"
              onClick={(e) => {
                e.stopPropagation();
                onToolSelect?.(activeTool === 'spec' ? null : 'spec');
              }}
              className={cn(
                TOOL_BTN,
                activeTool === 'spec' ? 'text-primary' : 'text-muted hover:text-text',
              )}
              title="Spec"
            >
              <ClipboardDocumentListIcon className="w-3.5 h-3.5" />
            </button>
            <span className="w-px h-3 bg-border mx-0.5" />
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
