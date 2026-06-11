import { useState } from 'react';
import {
  leafIdsInOrder,
  type PaneNode,
  usePaneActions,
  usePaneState,
  useTabState,
} from '@/contexts/TabContext';
import { PaneDivider } from './PaneDivider';
import { PaneLeafBody } from './panes/PaneLeafBody.tsx';
import { useMobileMode } from './useMobileMode';
import { useVisiblePaneIds } from './useVisiblePanes.ts';

/** 五落點 overlay（handoff §7）：拖曳 hover 在 leaf 上時浮出
 * 上/下/左/右（該方向 split 放入）＋中央（置換）。 */
const DROP_ZONES = [
  { key: 'top', label: '上', style: { left: '30%', right: '30%', top: 4, height: '24%' } },
  { key: 'bottom', label: '下', style: { left: '30%', right: '30%', bottom: 4, height: '24%' } },
  { key: 'left', label: '左', style: { left: 4, top: 4, bottom: 4, width: '26%' } },
  { key: 'right', label: '右', style: { right: 4, top: 4, bottom: 4, width: '26%' } },
  { key: 'center', label: '置換', style: { left: '36%', right: '36%', top: '40%', height: '22%' } },
] as const;

function DropZones({ paneId, onHide }: { paneId: string; onHide: () => void }): React.JSX.Element {
  const { movePane, swapPane } = usePaneActions();
  return (
    <div className="absolute inset-0 z-raised" data-testid="drop-zones">
      {DROP_ZONES.map((zone) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: drop target（dragover/drop）非點擊互動；鍵盤等效＝⌘\ split＋⌥方向鍵
        <div
          key={zone.key}
          data-testid={`drop-zone-${zone.key}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const sourceId = e.dataTransfer.getData('text/plain');
            onHide();
            if (!sourceId || sourceId === paneId) return;
            if (zone.key === 'center') {
              swapPane(sourceId, paneId);
            } else {
              movePane(sourceId, paneId, zone.key);
            }
          }}
          style={{ position: 'absolute', ...zone.style }}
          className="flex items-center justify-center rounded-(--radius-row) border-2 border-dashed border-accent/55 bg-accent/10 text-xs text-accent [&:hover]:border-solid [&:hover]:bg-accent/25"
        >
          {zone.label}
        </div>
      ))}
    </div>
  );
}

function PaneLeaf({ node }: { node: Extract<PaneNode, { type: 'leaf' }> }) {
  const { focusPane } = usePaneActions();
  const { paneRoot, focusedPaneId } = usePaneState();
  const { tabs } = useTabState();
  const isFocused = focusedPaneId === node.id;
  // permission mode 派發（handoff §2：plan=info、bypass=danger）——
  // [data-mode] CSS dispatch 改寫 --color-mode-accent，focused 邊框跟著換色
  const permissionMode =
    node.content.type === 'session' && node.content.sessionId
      ? tabs[node.content.sessionId]?.permissionMode
      : undefined;
  // 唯一 pane／尚無 focus 時不 dim（dim 只用來區分 focus 對象）
  const isDimmed = !isFocused && focusedPaneId !== null && paneRoot.type === 'split';
  // dragenter/leave 是巢狀冒泡事件——counter 避免子元素間移動時閃爍
  const [dragDepth, setDragDepth] = useState(0);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pane container handles click-to-focus; tabIndex={-1} is intentional for programmatic focus only
    <div
      data-testid="split-pane-leaf"
      data-pane-id={node.id}
      tabIndex={-1}
      onClick={() => focusPane(node.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') focusPane(node.id);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragDepth((d) => d + 1);
      }}
      onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => setDragDepth(0)}
      data-focused={isFocused || undefined}
      data-mode={permissionMode}
      style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
      className={`flex flex-1 min-w-0 min-h-0 flex-col rounded-(--pane-radius) border ${
        isFocused
          ? 'border-(--color-pane-focus) ring-1 ring-(--color-pane-focus-ring)'
          : `border-border ${isDimmed ? 'opacity-(--pane-dim-opacity)' : ''}`
      }`}
    >
      <PaneLeafBody node={node} />
      {dragDepth > 0 && <DropZones paneId={node.id} onHide={() => setDragDepth(0)} />}
    </div>
  );
}

function PaneSplit({
  node,
  visible,
}: {
  node: Extract<PaneNode, { type: 'split' }>;
  visible: Set<string> | null;
}) {
  const { updateRatio } = usePaneActions();

  // 可見性決策在 split 層（D4：zoom > RWD cap > all 的一般化）：
  // 可見 leaf 只在一側 → 直接渲染該側、不渲染 percentage wrapper 與 divider
  // —— 收納的 pane 才真正讓位（修「hidden 佔位空洞」bug）
  if (visible) {
    const firstVisible = leafIdsInOrder(node.first).some((id) => visible.has(id));
    const secondVisible = leafIdsInOrder(node.second).some((id) => visible.has(id));
    if (firstVisible !== secondVisible) {
      const side = firstVisible ? node.first : node.second;
      return <PaneTreeNode node={side} visible={visible} />;
    }
  }

  const isHorizontal = node.direction === 'h';
  const dimension = isHorizontal ? 'width' : 'height';
  const firstStyle: React.CSSProperties = { [dimension]: `${node.ratio * 100}%` };
  const secondStyle: React.CSSProperties = { [dimension]: `${(1 - node.ratio) * 100}%` };

  return (
    <div
      data-testid="split-pane-split"
      className={`flex flex-1 min-w-0 min-h-0 ${isHorizontal ? 'flex-row' : 'flex-col'}`}
    >
      <div style={firstStyle} className="flex min-w-0 min-h-0">
        <PaneTreeNode node={node.first} visible={visible} />
      </div>
      <PaneDivider
        direction={node.direction}
        onRatioChange={(ratio) => updateRatio(node.id, ratio)}
      />
      <div style={secondStyle} className="flex min-w-0 min-h-0">
        <PaneTreeNode node={node.second} visible={visible} />
      </div>
    </div>
  );
}

function PaneTreeNode({ node, visible }: { node: PaneNode; visible: Set<string> | null }) {
  // key={node.id}: leaf id 由 wire 帶來、跨裝置穩定 → rehydrate/swap 後 mount 身份可預期
  if (node.type === 'leaf') return <PaneLeaf key={node.id} node={node} />;
  return <PaneSplit key={node.id} node={node} visible={visible} />;
}

export function PaneTree(): React.JSX.Element {
  const { paneRoot, focusedPaneId } = usePaneState();
  const { focusPane } = usePaneActions();
  const { visible } = useVisiblePaneIds();
  const isMobile = useMobileMode();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // mobile 左右滑切 pane（handoff §8）：左滑＝下一個、右滑＝上一個（先序）
  function handleTouchEnd(e: React.TouchEvent): void {
    if (!isMobile || touchStartX === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    setTouchStartX(null);
    if (Math.abs(dx) < 50) return;
    const leaves = leafIdsInOrder(paneRoot);
    const current = focusedPaneId && leaves.includes(focusedPaneId) ? focusedPaneId : leaves[0];
    if (!current) return;
    const idx = leaves.indexOf(current);
    const next = dx < 0 ? leaves[idx + 1] : leaves[idx - 1];
    if (next) focusPane(next);
  }

  return (
    <div
      data-testid="split-pane-root"
      className="flex flex-1 min-w-0 min-h-0 overflow-hidden p-(--pane-gap) bg-bg"
      onTouchStart={(e) => setTouchStartX(e.changedTouches[0]?.clientX ?? null)}
      onTouchEnd={handleTouchEnd}
    >
      <PaneTreeNode node={paneRoot} visible={visible} />
    </div>
  );
}
