import { leafIdsInOrder, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { useTabletMode, useVisiblePaneIds } from './useVisiblePanes.ts';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

/**
 * Tablet 直立 tab 條（handoff §8）：超出上限的 pane 收成右側 34px 直立條，
 * 點擊把該 pane 帶進視野（focusPane——visible 集合衍生自 focused，
 * pane tree 結構不變）。
 */
export function CondensedPaneStrip(): React.JSX.Element | null {
  const { paneRoot } = usePaneState();
  const { focusPane } = usePaneActions();
  const isTablet = useTabletMode();
  const { condensed } = useVisiblePaneIds();

  if (!isTablet || condensed.length === 0) return null;
  const order = leafIdsInOrder(paneRoot);

  return (
    <div
      data-testid="condensed-pane-strip"
      className="flex flex-col items-center gap-1 w-8.5 py-2 border-l border-border bg-surface shrink-0"
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
            className="px-1 py-2 text-xs text-muted hover:text-text hover:bg-hover-tint rounded-(--radius-chip) [writing-mode:vertical-rl]"
          >
            {badge}
          </button>
        );
      })}
    </div>
  );
}
