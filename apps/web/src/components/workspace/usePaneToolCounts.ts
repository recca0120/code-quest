import { useEffect, useState } from 'react';
import { useGitActions } from '@/contexts/GitContext';
import { useOpenspecList } from '@/contexts/OpenspecContext';
import type { RailTab } from '@/contexts/TabContext';

/**
 * rail 分頁與 dock chips 共用的 count 來源（handoff §3：files·N／git·N／spec·N）。
 * files/git 同吃 git status 的 changedFilesCount；spec 走 openspec list
 * （首次訂閱觸發 fetch）。null＝未知（不顯示徽章）。
 */
export function usePaneToolCounts(cwd?: string): Partial<Record<RailTab, number | null>> {
  const { status } = useGitActions();
  const [gitCount, setGitCount] = useState<number | null>(null);
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

  return { files: gitCount, git: gitCount, spec: specCount };
}
