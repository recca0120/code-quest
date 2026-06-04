import type { WorktreeInfo } from '@code-quest/git';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useGitActions } from '@/contexts/GitContext';
import { useNavigationActions, useNavigationState } from '@/contexts/NavigationContext';
import { useProjectActions } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { copyToClipboard } from '@/utils/clipboard';
import { SessionHistoryPopover } from '../chat/session/SessionHistoryPopover.tsx';
import { GhostAddButton } from '../ui/GhostAddButton.tsx';
import { ArchiveWorktreeConfirmDialog } from './ArchiveWorktreeConfirmDialog.tsx';
import { CreateWorktreeDialog } from './CreateWorktreeDialog.tsx';
import { RemoveWorktreeConfirmDialog } from './RemoveWorktreeConfirmDialog.tsx';
import { RenameWorktreeDialog } from './RenameWorktreeDialog.tsx';
import { WorktreeBottomSheet } from './WorktreeBottomSheet.tsx';
import { WorktreeContextMenu, WorktreeDropdownMenu } from './WorktreeContextMenu.tsx';
import { WorktreeRow } from './WorktreeRow.tsx';

/** Dialogs (not menus/popovers) are still centrally owned since only one is
 *  visible at a time. Menus/popovers are now per-row Radix state. */
type Dialog =
  | { kind: 'remove'; wt: WorktreeInfo; activeCount: number }
  | { kind: 'rename'; wt: WorktreeInfo }
  | { kind: 'archive'; wt: WorktreeInfo; dirty: boolean }
  | { kind: 'resume'; wt: WorktreeInfo }
  | { kind: 'create' }
  | null;

export function WorktreeChildList({
  worktrees,
  projectCwd,
}: {
  worktrees: WorktreeInfo[];
  projectCwd: string;
}): React.JSX.Element {
  const { sessions } = useSession();
  const { setActiveProject } = useProjectActions();
  const { requestOpenWorktree, setSelectedWorktree, requestActivateChannel, recordLastWorktree } =
    useNavigationActions();
  const { lastTabByWorktree, selectedWorktreeCwd } = useNavigationState();
  const { removeWorktree, status, rename } = useGitActions();
  const { isDesktop } = useBreakpoint();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [changesByPath, setChangesByPath] = useState<Record<string, number>>({});
  const [bottomSheetWt, setBottomSheetWt] = useState<WorktreeInfo | null>(null);

  const closeDialog = () => setDialog(null);

  const openWorktreeInChat = (pCwd: string, wCwd: string, forceNew = false) => {
    setActiveProject(pCwd);
    setSelectedWorktree(pCwd, wCwd);
    requestOpenWorktree(pCwd, wCwd, forceNew);
  };

  const selectWorktree = (pCwd: string, wCwd: string) => {
    setActiveProject(pCwd);
    setSelectedWorktree(pCwd, wCwd);
    recordLastWorktree(pCwd, wCwd);
    const lastTab = lastTabByWorktree[wCwd];
    if (lastTab) requestActivateChannel(pCwd, lastTab);
  };

  useEffect(() => {
    let cancelled = false;
    async function fetchStatuses() {
      const results = await Promise.all(
        worktrees.map((wt) => status(wt.path).then((res) => ({ wt, res }))),
      );
      if (cancelled) return;
      const updates: Record<string, number> = {};
      for (const { wt, res } of results) {
        if ('changedFilesCount' in res) updates[wt.path] = res.changedFilesCount;
      }
      setChangesByPath((prev) => ({ ...prev, ...updates }));
    }
    void fetchStatuses();
    return () => {
      cancelled = true;
    };
  }, [worktrees, status]);

  const liveCountByPath = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      if (s.cwd && s.state !== 'exited') m.set(s.cwd, (m.get(s.cwd) ?? 0) + 1);
    }
    return m;
  }, [sessions]);
  // liveCountByPath is still needed for onDelete (activeCount in RemoveWorktreeConfirmDialog)

  function buildCallbacks(wt: WorktreeInfo) {
    return {
      onOpenHere: () => openWorktreeInChat(projectCwd, wt.path),
      onOpenInNewChat: () => openWorktreeInChat(projectCwd, wt.path, true),
      onOpenPastSession: () => setDialog({ kind: 'resume', wt }),
      onCopyPath: () => void copyToClipboard(wt.path),
      onRename: () => setDialog({ kind: 'rename', wt }),
      onArchive: () => setDialog({ kind: 'archive', wt, dirty: false }),
      onDelete: () =>
        setDialog({ kind: 'remove', wt, activeCount: liveCountByPath.get(wt.path) ?? 0 }),
    };
  }

  return (
    <div className="ml-5 border-l border-border pl-2">
      {worktrees.map((wt) => {
        const menuCallbacks = buildCallbacks(wt);
        return (
          <div key={wt.name}>
            <WorktreeContextMenu {...menuCallbacks}>
              <WorktreeRow
                worktree={wt}
                active={selectedWorktreeCwd[projectCwd] === wt.path}
                changes={changesByPath[wt.path] ?? 0}
                onSelect={() => selectWorktree(projectCwd, wt.path)}
                onOpenNewChat={() => openWorktreeInChat(projectCwd, wt.path, true)}
                wrapMoreTrigger={
                  isDesktop
                    ? (btn) => <WorktreeDropdownMenu trigger={btn} {...menuCallbacks} />
                    : undefined
                }
                onMoreActions={isDesktop ? undefined : () => setBottomSheetWt(wt)}
              />
            </WorktreeContextMenu>
          </div>
        );
      })}
      {dialog?.kind === 'rename' && (
        <RenameWorktreeDialog
          open
          currentBranch={dialog.wt.branch ?? dialog.wt.name}
          onSubmit={async (newName) => {
            const result = await rename(dialog.wt.path, newName);
            if ('error' in result) toast.error(`Rename failed: ${result.error}`);
            else toast.success(`Renamed to ${result.branch}`);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'archive' && (
        <ArchiveWorktreeConfirmDialog
          open
          branch={dialog.wt.branch ?? dialog.wt.name}
          dirty={dialog.dirty}
          onConfirm={async ({ force }) => {
            const result = await removeWorktree(projectCwd, dialog.wt.name, { force });
            if ('error' in result) {
              if (result.error === 'dirty') {
                setDialog({ kind: 'archive', wt: dialog.wt, dirty: true });
                return;
              }
              toast.error(`Archive failed: ${result.error}`);
              closeDialog();
              return;
            }
            toast.success(`Archived ${dialog.wt.name}`);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveWorktreeConfirmDialog
          open
          branch={dialog.wt.branch ?? dialog.wt.name}
          activeSessionCount={dialog.activeCount}
          onConfirm={() => void removeWorktree(projectCwd, dialog.wt.name, { force: true })}
          onClose={closeDialog}
        />
      )}
      <GhostAddButton
        onClick={() => setDialog({ kind: 'create' })}
        className="my-1 ml-2 px-2 py-1 text-left"
      >
        + New worktree…
      </GhostAddButton>
      {dialog?.kind === 'create' && (
        <CreateWorktreeDialog open cwd={projectCwd} onClose={closeDialog} />
      )}
      {dialog?.kind === 'resume' && (
        <SessionHistoryPopover
          cwd={dialog.wt.path}
          onClose={closeDialog}
          onResumed={(spawnedId, picked) => {
            requestActivateChannel(picked.cwd ?? dialog.wt.path, spawnedId);
            setActiveProject(projectCwd);
            closeDialog();
          }}
        />
      )}
      {bottomSheetWt && (
        <WorktreeBottomSheet
          wt={bottomSheetWt}
          onClose={() => setBottomSheetWt(null)}
          {...buildCallbacks(bottomSheetWt)}
        />
      )}
    </div>
  );
}
