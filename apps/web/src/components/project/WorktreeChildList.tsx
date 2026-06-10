import type { WorktreeInfo } from '@code-quest/git';
import { useEffect, useState } from 'react';
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
import { BranchPopover } from './BranchPopover.tsx';
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
  const { removeWorktree, listBranches, checkout, status, rename } = useGitActions();
  const { isDesktop } = useBreakpoint();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [branchPop, setBranchPop] = useState<{ wt: WorktreeInfo; branches: string[] } | null>(null);
  const [changesByPath, setChangesByPath] = useState<Record<string, number>>({});
  const [bottomSheetWt, setBottomSheetWt] = useState<WorktreeInfo | null>(null);

  const closeDialog = () => setDialog(null);

  function activateWorktree(pCwd: string, wCwd: string) {
    setActiveProject(pCwd);
    setSelectedWorktree(pCwd, wCwd);
  }

  const openWorktreeInChat = (pCwd: string, wCwd: string, forceNew = false) => {
    activateWorktree(pCwd, wCwd);
    requestOpenWorktree(wCwd, forceNew);
  };

  const selectWorktree = (pCwd: string, wCwd: string) => {
    activateWorktree(pCwd, wCwd);
    recordLastWorktree(pCwd, wCwd);
    const lastTab = lastTabByWorktree[wCwd];
    if (lastTab) requestActivateChannel(lastTab);
  };

  async function fetchAndOpenBranchPopover(wt: WorktreeInfo, open: boolean) {
    if (!open) {
      setBranchPop(null);
      return;
    }
    const res = await listBranches(projectCwd);
    setBranchPop({ wt, branches: Array.isArray(res) ? res : [] });
  }

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

  function buildCallbacks(wt: WorktreeInfo) {
    return {
      onOpenHere: () => openWorktreeInChat(projectCwd, wt.path),
      onOpenInNewChat: () => openWorktreeInChat(projectCwd, wt.path, true),
      onOpenPastSession: () => setDialog({ kind: 'resume', wt }),
      onSwitchBranch: () => void fetchAndOpenBranchPopover(wt, true),
      onCopyPath: () => void copyToClipboard(wt.path),
      onRename: () => setDialog({ kind: 'rename', wt }),
      onArchive: () => setDialog({ kind: 'archive', wt, dirty: false }),
      onDelete: () =>
        setDialog({
          kind: 'remove',
          wt,
          activeCount: sessions.filter((s) => s.cwd === wt.path && s.state !== 'exited').length,
        }),
    };
  }

  return (
    <div className="ml-5 border-l border-border pl-2">
      {worktrees.map((wt) => {
        const menuCallbacks = buildCallbacks(wt);
        return (
          <WorktreeContextMenu key={wt.name} {...menuCallbacks}>
            <WorktreeRow
              worktree={wt}
              active={selectedWorktreeCwd[projectCwd] === wt.path}
              changes={changesByPath[wt.path] ?? 0}
              onSelect={() => selectWorktree(projectCwd, wt.path)}
              onOpenNewChat={() => openWorktreeInChat(projectCwd, wt.path, true)}
              wrapBranchTrigger={(badge) => (
                <BranchPopover
                  trigger={badge}
                  open={branchPop?.wt.path === wt.path}
                  onOpenChange={(o) => void fetchAndOpenBranchPopover(wt, o)}
                  branches={branchPop?.wt.path === wt.path ? branchPop.branches : []}
                  current={wt.branch ?? null}
                  onSelect={(branch) => void checkout(wt.path, branch)}
                  onCreateBranch={() => setDialog({ kind: 'create' })}
                />
              )}
              wrapMoreTrigger={
                isDesktop
                  ? (btn) => <WorktreeDropdownMenu trigger={btn} {...menuCallbacks} />
                  : undefined
              }
              onMoreActions={isDesktop ? undefined : () => setBottomSheetWt(wt)}
            />
          </WorktreeContextMenu>
        );
      })}
      <WorktreeDialogs
        dialog={dialog}
        onClose={closeDialog}
        projectCwd={projectCwd}
        onSetDialog={setDialog}
        onRemoveWorktree={removeWorktree}
        onRename={rename}
        onRequestActivateChannel={requestActivateChannel}
        onSetActiveProject={setActiveProject}
      />
      <GhostAddButton
        onClick={() => setDialog({ kind: 'create' })}
        className="my-1 ml-2 px-2 py-1 text-left"
      >
        + New worktree…
      </GhostAddButton>
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

function WorktreeDialogs({
  dialog,
  onClose,
  projectCwd,
  onSetDialog,
  onRemoveWorktree,
  onRename,
  onRequestActivateChannel,
  onSetActiveProject,
}: {
  dialog: Dialog;
  onClose: () => void;
  projectCwd: string;
  onSetDialog: (d: Dialog) => void;
  onRemoveWorktree: ReturnType<typeof useGitActions>['removeWorktree'];
  onRename: ReturnType<typeof useGitActions>['rename'];
  onRequestActivateChannel: ReturnType<typeof useNavigationActions>['requestActivateChannel'];
  onSetActiveProject: ReturnType<typeof useProjectActions>['setActiveProject'];
}) {
  return (
    <>
      {dialog?.kind === 'rename' && (
        <RenameWorktreeDialog
          open
          currentBranch={dialog.wt.branch ?? dialog.wt.name}
          onSubmit={async (newName) => {
            const result = await onRename(dialog.wt.path, newName);
            if ('error' in result) toast.error(`Rename failed: ${result.error}`);
            else toast.success(`Renamed to ${result.branch}`);
            onClose();
          }}
          onClose={onClose}
        />
      )}
      {dialog?.kind === 'archive' && (
        <ArchiveWorktreeConfirmDialog
          open
          branch={dialog.wt.branch ?? dialog.wt.name}
          dirty={dialog.dirty}
          onConfirm={async ({ force }) => {
            const result = await onRemoveWorktree(projectCwd, dialog.wt.name, { force });
            if ('error' in result) {
              if (result.error === 'dirty') {
                onSetDialog({ kind: 'archive', wt: dialog.wt, dirty: true });
                return;
              }
              toast.error(`Archive failed: ${result.error}`);
              onClose();
              return;
            }
            toast.success(`Archived ${dialog.wt.name}`);
            onClose();
          }}
          onClose={onClose}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveWorktreeConfirmDialog
          open
          branch={dialog.wt.branch ?? dialog.wt.name}
          activeSessionCount={dialog.activeCount}
          onConfirm={() => void onRemoveWorktree(projectCwd, dialog.wt.name, { force: true })}
          onClose={onClose}
        />
      )}
      {dialog?.kind === 'create' && (
        <CreateWorktreeDialog open cwd={projectCwd} onClose={onClose} />
      )}
      {dialog?.kind === 'resume' && (
        <SessionHistoryPopover
          cwd={dialog.wt.path}
          onClose={onClose}
          onResumed={(spawnedId) => {
            onRequestActivateChannel(spawnedId);
            onSetActiveProject(projectCwd);
            onClose();
          }}
        />
      )}
    </>
  );
}
