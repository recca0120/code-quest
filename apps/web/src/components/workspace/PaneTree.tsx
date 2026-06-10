import { type PaneNode, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { PaneDivider } from './PaneDivider';
import { PaneLeafBody } from './panes/PaneLeafBody.tsx';
import { useMobileMode } from './useMobileMode';

type RenderLeaf = (node: PaneNode) => React.ReactNode;

function PaneLeaf({
  node,
  renderLeaf,
}: {
  node: Extract<PaneNode, { type: 'leaf' }>;
  renderLeaf?: RenderLeaf;
}) {
  const { zoomedPaneId, focusedPaneId } = usePaneState();
  const { focusPane } = usePaneActions();
  const isMobile = useMobileMode();
  const isZoomed = zoomedPaneId === node.id;
  const isFocused = focusedPaneId === node.id;
  const hidden =
    (isMobile && focusedPaneId !== null && !isFocused) || (zoomedPaneId !== null && !isZoomed);

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
      hidden={hidden}
      style={hidden ? undefined : { flex: 1, overflow: 'hidden' }}
      className="flex flex-1 min-w-0 min-h-0"
    >
      {renderLeaf ? renderLeaf(node) : <PaneLeafBody node={node} />}
    </div>
  );
}

function PaneSplit({
  node,
  renderLeaf,
}: {
  node: Extract<PaneNode, { type: 'split' }>;
  renderLeaf?: RenderLeaf;
}) {
  const { updateRatio } = usePaneActions();

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
        <PaneTreeNode node={node.first} renderLeaf={renderLeaf} />
      </div>
      <PaneDivider
        direction={node.direction}
        onRatioChange={(ratio) => updateRatio(node.id, ratio)}
      />
      <div style={secondStyle} className="flex min-w-0 min-h-0">
        <PaneTreeNode node={node.second} renderLeaf={renderLeaf} />
      </div>
    </div>
  );
}

function PaneTreeNode({ node, renderLeaf }: { node: PaneNode; renderLeaf?: RenderLeaf }) {
  if (node.type === 'leaf') return <PaneLeaf node={node} renderLeaf={renderLeaf} />;
  return <PaneSplit node={node} renderLeaf={renderLeaf} />;
}

export function PaneTree({ renderLeaf }: { renderLeaf?: RenderLeaf } = {}): React.JSX.Element {
  const { paneRoot } = usePaneState();
  return (
    <div data-testid="split-pane-root" className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
      <PaneTreeNode node={paneRoot} renderLeaf={renderLeaf} />
    </div>
  );
}
