import { useState } from 'react';
import {
  collectSessionsInPaneTree,
  leafIdsInOrder,
  type PaneNode,
  usePaneActions,
  usePaneState,
  useTabState,
} from '@/contexts/TabContext';
import { leafLabel } from './pane-label.ts';
import { PANE_TYPE_REGISTRY } from './pane-registry';
import { usePaneEnvironment } from './panes/PaneEnvironmentContext.tsx';
import { useMobileMode } from './useMobileMode';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';
const BUSY_STATUSES = new Set(['processing', 'busy', 'cancelling']);

function cardPreview(
  node: PaneNode,
  tabs: Record<string, { title?: string; cwd?: string }>,
): { icon: string; preview: string } | null {
  if (node.type !== 'leaf') return null;
  const c = node.content;
  if (c.type === 'session') {
    const meta = c.channelId ? tabs[c.channelId] : null;
    return { icon: '✦', preview: meta?.title ?? '' };
  }
  const entry = PANE_TYPE_REGISTRY.find((e) => e.key === c.type);
  if (!entry) return null;
  const cwd = 'target' in c ? c.target.cwd : '';
  return { icon: entry.icon, preview: cwd.split('/').pop() ?? cwd };
}

function findLeaf(node: PaneNode, id: string): PaneNode | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findLeaf(node.first, id) ?? findLeaf(node.second, id);
}

/**
 * Mobile 卡片牆切換器（handoff §8）：pane tree 攤平成 2 欄卡片（卡高 190px），
 * 點卡＝focusPane（solo rendering 跟著換）。active 卡 accent 框、busy 圓點、
 * × 關閉（>1 leaf 時）。⊞ 開關。
 */
interface MobilePaneWallProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobilePaneWall({
  open: externalOpen,
  onOpenChange,
}: MobilePaneWallProps = {}): React.JSX.Element | null {
  const { paneRoot, focusedPaneId } = usePaneState();
  const { focusPane, closePane } = usePaneActions();
  const { tabs } = useTabState();
  const isMobile = useMobileMode();
  const { onOpenModal } = usePaneEnvironment();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  if (!isMobile) return null;
  const leaves = leafIdsInOrder(paneRoot);
  if (leaves.length < 2) return null;

  return (
    <>
      <button
        type="button"
        data-testid="mobile-pane-wall-toggle"
        aria-label="open pane switcher"
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-3 z-float size-(--mobile-wall-toggle) rounded-(--radius-mobile-toggle) bg-bg border border-border text-text shadow-floating"
      >
        ⊞
      </button>
      {open && (
        <div className="fixed inset-0 z-overlay flex flex-col bg-overlay">
          <button
            type="button"
            aria-label="close pane switcher"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div
            data-testid="mobile-pane-wall"
            className="relative grid grid-cols-2 gap-3 p-3.5 mt-(--mobile-topbar-h) overflow-y-auto"
          >
            {leaves.map((id, idx) => {
              const isActive = focusedPaneId === id;
              const leaf = findLeaf(paneRoot, id);
              const isBusy =
                leaf !== null &&
                [...collectSessionsInPaneTree(leaf)].some(
                  (sid) => tabs[sid] && BUSY_STATUSES.has(tabs[sid].tabStatus),
                );
              return (
                // biome-ignore lint/a11y/useSemanticElements: 卡內含 × 關閉真 button，button 不可巢狀 → 卡用 role=button 的 div（tabIndex＋Enter/Space 鍵盤等效）
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  data-testid={`pane-wall-card-${id}`}
                  data-pane-id={id}
                  data-active={isActive || undefined}
                  onClick={() => {
                    focusPane(id);
                    setOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      focusPane(id);
                      setOpen(false);
                    }
                  }}
                  className={`flex flex-col items-start gap-2 h-(--wall-card-h) p-3 rounded-(--radius-mobile-card) border bg-surface text-left text-[length:var(--text-body)] cursor-pointer ${
                    isActive
                      ? 'border-(--color-pane-focus) ring-1 ring-(--color-pane-focus-ring)'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  <span className="flex items-center gap-1.5 w-full">
                    <span className="font-mono text-2xs text-accent">
                      {CIRCLED[idx] ?? idx + 1}
                    </span>
                    {isBusy && (
                      <span
                        aria-hidden="true"
                        data-testid={`pane-wall-busy-${id}`}
                        className="size-1.5 rounded-full bg-accent animate-busy-pulse"
                      />
                    )}
                    {leaves.length > 1 && (
                      <button
                        type="button"
                        aria-label="close pane"
                        data-testid={`pane-wall-close-${id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          closePane(id);
                        }}
                        className="ml-auto text-muted hover:text-text"
                      >
                        ×
                      </button>
                    )}
                  </span>
                  <span className="truncate text-text">{leafLabel(paneRoot, id)}</span>
                  {(() => {
                    const info = leaf ? cardPreview(leaf, tabs) : null;
                    return info ? (
                      <span
                        data-testid={`pane-wall-preview-${id}`}
                        className="flex items-center gap-1 text-2xs text-subtle truncate w-full"
                      >
                        <span>{info.icon}</span>
                        <span className="truncate">{info.preview}</span>
                      </span>
                    ) : null;
                  })()}
                </div>
              );
            })}
            {onOpenModal && (
              <button
                type="button"
                data-testid="pane-wall-add-card"
                onClick={() => {
                  setOpen(false);
                  onOpenModal();
                }}
                className="flex flex-col items-center justify-center h-(--wall-card-h) rounded-(--radius-mobile-card) border border-dashed border-border bg-surface text-subtle hover:text-text hover:border-accent cursor-pointer"
              >
                <span className="text-xl">＋</span>
                <span className="text-2xs">新增 pane</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
