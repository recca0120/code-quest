import { leafIdsInOrder, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { leafLabel } from './pane-label.ts';
import { usePaneEnvironment } from './panes/PaneEnvironmentContext.tsx';
import { useTabletMode, useVisiblePaneIds } from './useVisiblePanes.ts';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

/**
 * Tablet 直立 tab 條（handoff §8）：超出上限的 pane 收成右側 34px 直立條，
 * 點擊把該 pane 帶進視野（focusPane——visible 集合衍生自 focused，
 * pane tree 結構不變）。chip 樣式照設計稿 .tx-edge-tab（編號＋類型名），
 * 條尾虛線「＋」開 picker。
 */
export function CondensedPaneStrip(): React.JSX.Element | null {
  const { paneRoot } = usePaneState();
  const { focusPane } = usePaneActions();
  const { onOpenModal } = usePaneEnvironment();
  const isTablet = useTabletMode();
  const { condensed } = useVisiblePaneIds();

  if (!isTablet || condensed.length === 0) return null;
  const order = leafIdsInOrder(paneRoot);

  return (
    <div
      data-testid="condensed-pane-strip"
      className="flex flex-col items-center gap-1.5 w-8.5 py-2 border-l border-border bg-surface shrink-0"
    >
      {condensed.map((id) => {
        const idx = order.indexOf(id);
        const badge = idx >= 0 && idx < CIRCLED.length ? CIRCLED[idx] : `#${idx + 1}`;
        return (
          <button
            key={id}
            type="button"
            data-testid={`condensed-pane-${id}`}
            data-pane-id={id}
            onClick={() => focusPane(id)}
            title={`顯示 pane ${badge}`}
            className="flex items-center gap-1.5 px-1 py-2.5 text-2xs text-muted hover:text-text bg-bg border border-border rounded-(--radius-row) [writing-mode:vertical-rl]"
          >
            <span aria-hidden="true" className="font-mono">
              {badge}
            </span>
            <span className="truncate">{leafLabel(paneRoot, id)}</span>
          </button>
        );
      })}
      {onOpenModal && (
        <button
          type="button"
          data-testid="condensed-strip-add"
          aria-label="open pane picker"
          onClick={() => onOpenModal()}
          className="px-1 py-2.5 text-2xs text-subtle hover:text-text bg-bg border border-dashed border-border rounded-(--radius-row) [writing-mode:vertical-rl]"
        >
          ＋
        </button>
      )}
    </div>
  );
}
