import {
  leafIdsInOrder,
  type PaneContent,
  type PaneNode,
  type TabMeta,
  usePaneState,
  useTabState,
} from '@/contexts/TabContext';
import { CIRCLED } from './pane-label.ts';
import { PANE_TYPE_REGISTRY } from './pane-registry';

function findLeafContent(node: PaneNode, paneId: string): PaneContent | null {
  if (node.type === 'leaf') return node.id === paneId ? node.content : null;
  return findLeafContent(node.first, paneId) ?? findLeafContent(node.second, paneId);
}

/**
 * Zoom 中 pane 的「icon＋標題」描述（handoff §6 文案）：
 * session → tabs meta.title，退而求 cwd 尾段；tool → registry label。
 * 推不出標題時回 null（文案略過該段）。
 */
function zoomDetail(content: PaneContent, tabs: Record<string, TabMeta>): string | null {
  const key = content.type === 'session' ? 'chat' : content.type;
  const entry = PANE_TYPE_REGISTRY.find((e) => e.key === key);
  if (content.type === 'session') {
    const meta = content.channelId ? tabs[content.channelId] : undefined;
    const cwd = meta?.cwd ?? content.cwd;
    const title = meta?.title ?? cwd?.split('/').filter(Boolean).pop();
    return title ? `${entry?.icon ?? ''} ${title}`.trim() : null;
  }
  return entry ? `${entry.icon} ${entry.label}` : null;
}

/**
 * Zoom bar（handoff §6）：zoom 中於 pane 區頂部顯示 accent-soft 提示列——
 * 「⤢ Zoom 中 — pane ② ✦ 標題（共 N 個 pane）」＋返回提示。esc／⌘⇧Z 解除。
 */
export function ZoomBar(): React.JSX.Element | null {
  const { paneRoot, zoomedPaneId } = usePaneState();
  const { tabs } = useTabState();
  if (!zoomedPaneId) return null;
  const leaves = leafIdsInOrder(paneRoot);
  const idx = leaves.indexOf(zoomedPaneId);
  const badge = idx >= 0 && idx < CIRCLED.length ? CIRCLED[idx] : `#${idx + 1}`;
  const content = findLeafContent(paneRoot, zoomedPaneId);
  const detail = content ? zoomDetail(content, tabs) : null;
  return (
    <div
      data-testid="zoom-bar"
      className="flex items-center gap-2 px-3 py-1 bg-(--color-accent-soft) border-b border-(--color-accent-border-35) text-[length:var(--text-header)] text-accent shrink-0"
    >
      <span>
        ⤢ Zoom 中 — pane {badge}
        {detail ? ` ${detail}` : ''}（共 {leaves.length} 個 pane）
      </span>
      <span className="ml-auto font-mono text-2xs">⌘⇧Z 或 esc 返回分割</span>
    </div>
  );
}
