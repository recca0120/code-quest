import { useEffect, useState } from 'react';
import { useGitActions } from '@/contexts/GitContext';
import { useOpenspecList } from '@/contexts/OpenspecContext';
import type { RailTab } from '@/contexts/TabContext';
import { RAIL_TABS } from '../RightPane.tsx';

/**
 * Dock chips（handoff §3：rail 收合態）——chat 底部一列 pill，與 rail
 * 同一資料源（RAIL_TABS），點 chip 重新展開 rail 至該分頁。
 */
export function PaneDock({
  cwd,
  onOpen,
}: {
  cwd?: string;
  onOpen: (tab: RailTab) => void;
}): React.JSX.Element {
  const { status } = useGitActions();
  const [gitCount, setGitCount] = useState<number | null>(null);
  // spec count 被動讀（rail 開過 spec 分頁後 store 有資料）——dock 是 rail 的影子
  const specList = useOpenspecList(cwd ?? '');
  const specCount = specList && 'changes' in specList ? specList.changes.length : null;

  useEffect(() => {
    if (!cwd) return;
    let alive = true;
    void status(cwd).then((res) => {
      if (alive && 'changedFilesCount' in res) setGitCount(res.changedFilesCount);
    });
    return () => {
      alive = false;
    };
  }, [cwd, status]);

  // chip count（handoff §3：files·N／git·N／spec·N）
  const counts: Partial<Record<RailTab, number | null>> = {
    files: gitCount,
    git: gitCount,
    spec: specCount,
  };

  return (
    <div
      data-testid="pane-dock"
      className="flex items-center gap-1.5 px-3 py-1 border-t border-border-subtle bg-surface shrink-0 max-md:pb-(--safe-bottom)"
    >
      {RAIL_TABS.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          data-testid={`pane-dock-chip-${key}`}
          onClick={() => onOpen(key)}
          className="flex items-center gap-1 px-2.5 text-xs rounded-full border border-border hover:bg-hover-tint h-(--dock-chip-h)"
        >
          {icon}
          <span>{label}</span>
          {(counts[key] ?? 0) > 0 && (
            <span data-testid={`pane-dock-count-${key}`} className="font-mono text-2xs text-accent">
              {counts[key]}
            </span>
          )}
        </button>
      ))}
      <span className="ml-auto font-mono text-2xs text-dim whitespace-nowrap hidden sm:inline">
        點 chip 展開側欄
      </span>
    </div>
  );
}
