import { leafIdsInOrder, usePaneState } from '@/contexts/TabContext';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

/**
 * Zoom bar（handoff §6）：zoom 中於 pane 區頂部顯示 accent-soft 提示列——
 * 「⤢ Zoom 中 — pane ②（共 N 個 pane）」＋返回提示。esc／⌘⇧Z 解除。
 */
export function ZoomBar(): React.JSX.Element | null {
  const { paneRoot, zoomedPaneId } = usePaneState();
  if (!zoomedPaneId) return null;
  const leaves = leafIdsInOrder(paneRoot);
  const idx = leaves.indexOf(zoomedPaneId);
  const badge = idx >= 0 && idx < CIRCLED.length ? CIRCLED[idx] : `#${idx + 1}`;
  return (
    <div
      data-testid="zoom-bar"
      className="flex items-center gap-2 px-3 py-1 bg-accent/10 border-b border-accent/25 text-xs text-accent shrink-0"
    >
      <span>
        ⤢ Zoom 中 — pane {badge}（共 {leaves.length} 個 pane）
      </span>
      <span className="ml-auto font-mono text-2xs">⌘⇧Z 或 esc 返回分割</span>
    </div>
  );
}
