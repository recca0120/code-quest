import { ArrowsPointingOutIcon, ViewColumnsIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { leafIdsInOrder, usePaneState } from '@/contexts/TabContext';
import { cn } from '@/utils/cn';
import { useMobileMode } from './useMobileMode';

interface ToolbarProps {
  paneId: string;
  branch?: string;
  title?: string;
  cwd?: string;
  isOnly?: boolean;
  /** pane 類型 glyph（handoff §2 組成：編號徽章→類型 icon→標題）；session pane 傳 chat ✦ */
  typeIcon?: React.ReactNode;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onZoom?: () => void;
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
  typeIcon,
  onSplitH,
  onSplitV,
  onZoom,
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
  const ghostRef = useRef<HTMLElement | null>(null);

  function removeGhost() {
    ghostRef.current?.remove();
    ghostRef.current = null;
  }

  // unmount 時清掉殘留 ghost（drag 中 pane 被關閉等邊界）
  // biome-ignore lint/correctness/useExhaustiveDependencies: cleanup-only effect
  useEffect(() => removeGhost, []);

  function handleDragStart(e: React.DragEvent) {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', paneId);
    e.dataTransfer.effectAllowed = 'move';
    // ghost 縮影（handoff §7）：clone 整個 pane、半尺寸 cap 330×170、-1.5° 浮起
    // happy-dom/jsdom 無 setDragImage → guard
    if (typeof e.dataTransfer.setDragImage !== 'function') return;
    const pane = e.currentTarget.closest('[data-pane-id]');
    if (!(pane instanceof HTMLElement)) return;
    const width = Math.min(Math.round(pane.offsetWidth / 2) || 330, 330);
    const height = Math.min(Math.round(pane.offsetHeight / 2) || 170, 170);
    const ghost = pane.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, {
      // 置 offscreen——setDragImage 的來源節點必須在 DOM 內，但不能閃現在版面上
      position: 'fixed',
      top: '-10000px',
      left: '0px',
      width: `${width}px`,
      height: `${height}px`,
      transform: 'rotate(-1.5deg)',
      opacity: '0.92',
      border: '1px solid var(--color-accent)',
      borderRadius: '10px',
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
      // happy-dom 的 setDragImage 存在但擲 Not implemented——不留孤兒節點
      removeGhost();
    }
  }

  function handleDragEnd() {
    setIsDragging(false);
    removeGhost();
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
      className="flex items-center gap-2 px-2.5 text-xs bg-surface border-b border-(--color-border-subtle) h-(--pane-header-h) shrink-0"
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
      {branch && <span className="font-mono text-2xs text-subtle">⎇ {branch}</span>}
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
            <button
              type="button"
              data-testid="pane-zoom"
              onClick={(e) => {
                e.stopPropagation();
                onZoom?.();
              }}
              className={cn(TOOL_BTN, 'text-muted hover:text-text')}
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
