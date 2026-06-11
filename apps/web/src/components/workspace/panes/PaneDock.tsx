import type { PaneContent, RailTab } from '@/contexts/TabContext';
import { cn } from '@/utils/cn';
import { RAIL_TABS, railTabContent } from '../RightPane.tsx';
import { usePaneToolCounts } from '../usePaneToolCounts.ts';

/**
 * Dock chips（handoff §3：rail 收合態）——chat 底部一列 pill，與 rail
 * 同一資料源（RAIL_TABS），點 chip 重新展開 rail 至該分頁。
 */
export function PaneDock({
  cwd,
  onOpen,
  activeTab,
  onPromote,
}: {
  cwd?: string;
  onOpen: (tab: RailTab) => void;
  /** rail 收合前最後停留的分頁——對應 chip 顯示 active 態（handoff §3） */
  activeTab?: RailTab;
  /** ⌘⏎（焦點在 dock 區內）把 activeTab 升級成獨立 pane（spec SHALL） */
  onPromote?: (content: PaneContent) => void;
}): React.JSX.Element {
  // chip count（handoff §3：files·N／git·N／spec·N）——與 rail 分頁同一 hook
  const counts = usePaneToolCounts(cwd);

  function handleKeyDown(e: React.KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onPromote && cwd) {
      e.preventDefault();
      onPromote(railTabContent(activeTab ?? 'files', cwd));
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: ⌘⏎ 升級——chip 鈕為焦點載體，容器只攔組合鍵
    <div
      data-testid="pane-dock"
      onKeyDown={handleKeyDown}
      className="flex items-center gap-1.5 px-3 py-1 border-t border-border-subtle bg-surface shrink-0 max-md:pb-(--safe-bottom)"
    >
      {RAIL_TABS.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          data-testid={`pane-dock-chip-${key}`}
          onClick={() => onOpen(key)}
          className={cn(
            'flex items-center gap-1 px-2.5 text-[length:var(--text-label)] rounded-full border h-(--dock-chip-h)',
            key === activeTab
              ? 'bg-accent-soft border-[color-mix(in_srgb,var(--color-accent)_50%,var(--color-border))] text-bright'
              : 'border-border hover:bg-hover-tint',
          )}
        >
          {icon}
          <span>{label}</span>
          {(counts[key] ?? 0) > 0 && (
            <span
              data-testid={`pane-dock-count-${key}`}
              className="font-mono text-[length:var(--text-count-dock)] text-(--color-accent-strong)"
            >
              {counts[key]}
            </span>
          )}
        </button>
      ))}
      <span className="ml-auto font-mono text-2xs text-dim whitespace-nowrap">
        <span className="max-md:hidden">點 chip 開 drawer・⌘⏎ 升級成 pane</span>
        <span className="md:hidden">左右滑切 pane</span>
      </span>
    </div>
  );
}
