import { ArrowsPointingOutIcon, ViewColumnsIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { leafIdsInOrder, usePaneState } from '@/contexts/TabContext';
import { cn } from '@/utils/cn';
import { useMobileMode } from '../useMobileMode';

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
}

interface ToolbarProps extends PaneToolbarCommonProps {
  cwd?: string;
  children?: React.ReactNode;
}

const TOOL_BTN =
  'w-6 h-6 flex items-center justify-center rounded hover:bg-hover-tint transition-colors';

export function Toolbar({
  paneId,
  branch,
  title,
  isOnly = false,
  typeIcon,
  onSplitH,
  onSplitV,
  onZoom,
  onClose,
  children,
}: ToolbarProps): React.JSX.Element {
  const { paneRoot, focusedPaneId, zoomedPaneId } = usePaneState();
  const isFocused = focusedPaneId === paneId;
  const paneIndex = leafIdsInOrder(paneRoot).indexOf(paneId);
  const isZoomed = zoomedPaneId === paneId;
  const isMobile = useMobileMode();
  const [isDragging, setIsDragging] = useState(false);
  const ghostRef = useRef<HTMLElement | null>(null);

  function removeGhost() {
    ghostRef.current?.remove();
    ghostRef.current = null;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: cleanup-only effect
  useEffect(() => removeGhost, []);

  function handleDragStart(e: React.DragEvent) {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', paneId);
    e.dataTransfer.effectAllowed = 'move';
    if (typeof e.dataTransfer.setDragImage !== 'function') return;
    const pane = e.currentTarget.closest('[data-pane-id]');
    if (!(pane instanceof HTMLElement)) return;
    const width = Math.min(Math.round(pane.offsetWidth / 2) || 330, 330);
    const height = Math.min(Math.round(pane.offsetHeight / 2) || 170, 170);
    const ghost = pane.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, {
      position: 'fixed',
      top: '-10000px',
      left: '0px',
      width: `${width}px`,
      height: `${height}px`,
      transform: 'rotate(-1.5deg)',
      opacity: '0.92',
      border: '1px solid color-mix(in srgb, var(--color-accent) 60%, var(--color-border))',
      borderRadius: 'var(--pane-radius)',
      boxShadow: 'var(--shadow-floating)',
      backgroundColor: 'var(--color-surface)',
      overflow: 'hidden',
      pointerEvents: 'none',
    });
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    try {
      e.dataTransfer.setDragImage(ghost, Math.round(width / 2), 16);
    } catch {
      removeGhost();
    }
  }

  function handleDragEnd() {
    setIsDragging(false);
    removeGhost();
  }

  return (
    <div
      role="toolbar"
      data-testid="pane-header"
      data-focused={isFocused || undefined}
      data-dragging={isDragging || undefined}
      draggable={!isMobile}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="flex items-center gap-2 px-2.5 text-[length:var(--text-header)] text-muted bg-surface border-b border-(--color-border-subtle) h-(--pane-header-h) shrink-0"
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
      {typeIcon && (
        <span aria-hidden="true" className="text-muted shrink-0">
          {typeIcon}
        </span>
      )}
      {title && <span className="font-semibold text-bright truncate">{title}</span>}
      {branch && <span className="font-mono text-subtle">⎇ {branch}</span>}
      {isZoomed && (
        <span
          data-testid="pane-zoomed-indicator"
          role="img"
          aria-label="Zoomed"
          className="text-accent"
        >
          ⤢
        </span>
      )}
      {children && <div className="flex items-center gap-1 ml-1">{children}</div>}
      <div className="ml-auto flex items-center gap-2">
        {!isMobile && (
          <>
            <button
              type="button"
              data-testid="pane-split-h"
              onClick={(e) => {
                e.stopPropagation();
                onSplitH?.();
              }}
              className={cn(TOOL_BTN, 'text-subtle hover:text-text')}
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
              className={cn(TOOL_BTN, 'text-subtle hover:text-text rotate-90')}
              title="Split vertically"
            >
              <ViewColumnsIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="pane-zoom"
              onClick={(e) => {
                e.stopPropagation();
                onZoom?.();
              }}
              className={cn(TOOL_BTN, 'text-subtle hover:text-text')}
              title="Zoom pane"
            >
              <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
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
          className={cn(TOOL_BTN, 'text-subtle hover:text-text disabled:opacity-30')}
          title="Close pane"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Content({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex-1 overflow-auto min-h-0">{children}</div>;
}

/**
 * The single place that renders Toolbar + Content for leaf bodies — toolbar
 * existence and common-prop wiring are guaranteed here, named pane components
 * only contribute the `tools` slot and the body.
 */
export function Pane({
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
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <Toolbar {...toolbarProps}>{tools}</Toolbar>
      <div className="flex flex-col flex-1 min-w-0 min-h-0 group-data-[dimmed]/pane:opacity-(--pane-dim-opacity)">
        {scrollable ? <Content>{children}</Content> : children}
      </div>
    </div>
  );
}
