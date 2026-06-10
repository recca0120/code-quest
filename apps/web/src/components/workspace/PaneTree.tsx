import { hasLeaf, type PaneNode, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { PaneDivider } from './PaneDivider';
import { PaneLeafBody } from './panes/PaneLeafBody.tsx';
import { useMobileMode } from './useMobileMode';

/** zoom（或 mobile 時的 focus）指定的「唯一顯示」pane id */
function useSoloPaneId(): string | null {
  const { zoomedPaneId, focusedPaneId } = usePaneState();
  const isMobile = useMobileMode();
  return zoomedPaneId ?? (isMobile ? focusedPaneId : null);
}

function PaneLeaf({ node }: { node: Extract<PaneNode, { type: 'leaf' }> }) {
  const { focusPane } = usePaneActions();

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
      style={{ flex: 1, overflow: 'hidden' }}
      className="flex flex-1 min-w-0 min-h-0"
    >
      <PaneLeafBody node={node} />
    </div>
  );
}

function PaneSplit({ node }: { node: Extract<PaneNode, { type: 'split' }> }) {
  const { updateRatio } = usePaneActions();
  const soloId = useSoloPaneId();

  // Solo 決策在 split 層：目標只在一側 → 直接渲染該側、不渲染 percentage wrapper
  // 與 divider —— zoomed/mobile-focused pane 才真正佔滿（修「hidden 佔位空洞」bug：
  // 舊作法在 leaf 層 hidden，但 wrapper 的 width:N% 還在，zoom 毫無放大效果）
  if (soloId) {
    const inFirst = hasLeaf(node.first, soloId);
    const inSecond = hasLeaf(node.second, soloId);
    if (inFirst !== inSecond) {
      const side = inFirst ? node.first : node.second;
      return <PaneTreeNode node={side} />;
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
        <PaneTreeNode node={node.first} />
      </div>
      <PaneDivider
        direction={node.direction}
        onRatioChange={(ratio) => updateRatio(node.id, ratio)}
      />
      <div style={secondStyle} className="flex min-w-0 min-h-0">
        <PaneTreeNode node={node.second} />
      </div>
    </div>
  );
}

function PaneTreeNode({ node }: { node: PaneNode }) {
  // key={node.id}: leaf id 由 wire 帶來、跨裝置穩定 → rehydrate/swap 後 mount 身份可預期
  if (node.type === 'leaf') return <PaneLeaf key={node.id} node={node} />;
  return <PaneSplit key={node.id} node={node} />;
}

export function PaneTree(): React.JSX.Element {
  const { paneRoot } = usePaneState();
  return (
    <div data-testid="split-pane-root" className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
      <PaneTreeNode node={paneRoot} />
    </div>
  );
}
