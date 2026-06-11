import { useEffect, useState } from 'react';
import { useGitActions } from '@/contexts/GitContext';
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
          {key === 'git' && gitCount !== null && gitCount > 0 && (
            <span className="font-mono text-2xs text-accent">{gitCount}</span>
          )}
        </button>
      ))}
      <span className="ml-auto font-mono text-2xs text-dim whitespace-nowrap hidden sm:inline">
        點 chip 展開側欄
      </span>
    </div>
  );
}
