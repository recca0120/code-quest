import type { WorktreeInfo } from '@code-quest/git';
import type { SessionStateSummary } from '@code-quest/schemas';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useGitActions } from '@/contexts/GitContext';
import {
  NavigationStateContext,
  useNavigationActions,
  useNavigationState,
} from '@/contexts/NavigationContext';
import { useProjectActions } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { BottomSheet, BottomSheetItem } from '../ui/BottomSheet.tsx';
import { GhostAddButton } from '../ui/GhostAddButton.tsx';
import { StatusDot } from '../ui/StatusDot.tsx';
import { ArchiveWorktreeConfirmDialog } from './ArchiveWorktreeConfirmDialog.tsx';
import { BranchPopover } from './BranchPopover.tsx';
import { CreateWorktreeDialog } from './CreateWorktreeDialog.tsx';
import { RemoveWorktreeConfirmDialog } from './RemoveWorktreeConfirmDialog.tsx';
import { RenameWorktreeDialog } from './RenameWorktreeDialog.tsx';
import { WorktreeContextMenu, WorktreeDropdownMenu } from './WorktreeContextMenu.tsx';
import { WorktreeRow } from './WorktreeRow.tsx';

/** Dialogs (not menus/popovers) are still centrally owned since only one is
 *  visible at a time. Menus/popovers are now per-row Radix state. */
type Dialog =
  | { kind: 'remove'; wt: WorktreeInfo; activeCount: number }
  | { kind: 'rename'; wt: WorktreeInfo }
  | { kind: 'archive'; wt: WorktreeInfo; dirty: boolean }
  | { kind: 'create' }
  | null;

function sessionDotProps(state: string): {
  color: 'accent' | 'success' | 'danger' | 'muted';
  pulse?: boolean;
} {
  if (state === 'busy' || state === 'processing' || state === 'connecting')
    return { color: 'accent', pulse: true };
  if (state === 'idle') return { color: 'success' };
  if (state === 'disconnected') return { color: 'danger' };
  return { color: 'muted' };
}

function SessionList({
  sessions,
  activeTabId,
  onSelect,
  onClose,
}: {
  sessions: SessionStateSummary[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="ml-3 border-l border-border pl-2 flex flex-col">
      {sessions.map((s) => {
        const { color, pulse } = sessionDotProps(s.state);
        const label = s.title ?? s.channelId.slice(0, 8);
        const isActive = s.channelId === activeTabId;
        return (
          <div
            key={s.channelId}
            className={`group relative flex items-center gap-1.5 px-2 py-1 text-xs rounded ${
              isActive ? 'bg-accent/10 text-text' : 'text-muted hover:bg-hover-tint hover:text-text'
            }`}
          >
            <button
              type="button"
              aria-label={`Session: ${label}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(s.channelId)}
              className="absolute inset-0"
            />
            <StatusDot color={color} pulse={pulse} className="relative z-10 shrink-0" />
            <span className="relative z-10 truncate flex-1">{label}</span>
            <button
              type="button"
              aria-label={`Close session: ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(s.channelId);
              }}
              className="relative z-10 shrink-0 px-0.5 rounded text-subtle hover:text-danger opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function WorktreeChildList({
  worktrees,
  projectCwd,
}: {
  worktrees: WorktreeInfo[];
  projectCwd: string;
}): React.JSX.Element {
  const { sessions, closeSession } = useSession();
  const { setActiveProject } = useProjectActions();
  const { requestOpenWorktree, setSelectedWorktree } = useNavigationActions();
  const { selectedWorktreeCwd } = useNavigationState();
  const { removeWorktree, listBranches, checkout, status, rename } = useGitActions();
  const { requestActivateChannel } = useNavigationActions();
  const navState = useContext(NavigationStateContext);
  const activeTabId = navState?.pendingActivateChannel?.channelId ?? null;
  const { isDesktop } = useBreakpoint();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [branchPop, setBranchPop] = useState<{ wt: WorktreeInfo; branches: string[] } | null>(null);
  const [changesByPath, setChangesByPath] = useState<Record<string, number>>({});
  const [bottomSheetWt, setBottomSheetWt] = useState<WorktreeInfo | null>(null);

  const closeDialog = useCallback(() => setDialog(null), []);

  const selectWorktree = useCallback(
    (pCwd: string, wCwd: string) => {
      setActiveProject(pCwd);
      setSelectedWorktree(pCwd, wCwd);
    },
    [setActiveProject, setSelectedWorktree],
  );

  const openWorktreeInChat = useCallback(
    (pCwd: string, wCwd: string, forceNew = false) => {
      setActiveProject(pCwd);
      setSelectedWorktree(pCwd, wCwd);
      requestOpenWorktree(pCwd, wCwd, forceNew);
    },
    [setActiveProject, setSelectedWorktree, requestOpenWorktree],
  );

  const handleSelectSession = useCallback(
    (channelId: string) => {
      // Cross-provider boundary: NavigationContext → TabProvider picks up pendingActivateChannel
      const session = sessions.find((s) => s.channelId === channelId);
      if (session) requestActivateChannel(session.cwd ?? projectCwd, channelId);
    },
    [sessions, projectCwd, requestActivateChannel],
  );

  const handleCloseSession = useCallback(
    (channelId: string) => {
      // closeSession notifies server; TabProvider's sessions-diff effect handles removeTab
      closeSession(channelId);
    },
    [closeSession],
  );

  async function handleBranchPopoverOpen(wt: WorktreeInfo, open: boolean) {
    if (!open) {
      setBranchPop(null);
      return;
    }
    const res = await listBranches(projectCwd);
    setBranchPop({ wt, branches: Array.isArray(res) ? res : [] });
  }

  // Server-sourced status (changed-file counts per worktree).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        worktrees.map((wt) => status(wt.path).then((res) => ({ wt, res }))),
      );
      if (cancelled) return;
      const updates: Record<string, number> = {};
      for (const { wt, res } of results) {
        if ('changedFilesCount' in res) updates[wt.path] = res.changedFilesCount;
      }
      setChangesByPath((prev) => ({ ...prev, ...updates }));
    })();
    return () => {
      cancelled = true;
    };
  }, [worktrees, status]);

  const sessionsByPath = useMemo(() => {
    const m = new Map<string, SessionStateSummary[]>();
    for (const s of sessions) {
      if (s.state === 'exited') continue;
      const key = s.cwd ?? projectCwd;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return m;
  }, [sessions, projectCwd]);

  return (
    <div className="ml-5 border-l border-border pl-2">
      {worktrees.map((wt) => {
        const menuCallbacks = {
          onOpenHere: () => openWorktreeInChat(projectCwd, wt.path),
          onOpenInNewChat: () => openWorktreeInChat(projectCwd, wt.path, true),
          onCopyPath: () => {
            void navigator.clipboard?.writeText(wt.path);
          },
          onRename: () => setDialog({ kind: 'rename', wt }),
          onArchive: () => setDialog({ kind: 'archive', wt, dirty: false }),
          onDelete: () =>
            setDialog({
              kind: 'remove',
              wt,
              activeCount: sessionsByPath.get(wt.path)?.length ?? 0,
            }),
        };
        const wtSessions = sessionsByPath.get(wt.path) ?? [];
        return (
          <div key={wt.name}>
            <WorktreeContextMenu {...menuCallbacks}>
              <WorktreeRow
                worktree={wt}
                active={selectedWorktreeCwd[projectCwd] === wt.path}
                liveSessions={sessionsByPath.get(wt.path)?.length ?? 0}
                changes={changesByPath[wt.path] ?? 0}
                onSelect={() => selectWorktree(projectCwd, wt.path)}
                onOpenNewChat={() => openWorktreeInChat(projectCwd, wt.path, true)}
                wrapBranchTrigger={(badge) => (
                  <BranchPopover
                    trigger={badge}
                    open={branchPop?.wt.path === wt.path}
                    onOpenChange={(o) => void handleBranchPopoverOpen(wt, o)}
                    branches={branchPop?.wt.path === wt.path ? branchPop.branches : []}
                    current={wt.branch ?? null}
                    onSelect={(branch) => {
                      void checkout(wt.path, branch);
                    }}
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
            {wtSessions.length > 0 && (
              <SessionList
                sessions={wtSessions}
                activeTabId={activeTabId}
                onSelect={handleSelectSession}
                onClose={handleCloseSession}
              />
            )}
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
          onConfirm={() => {
            void removeWorktree(projectCwd, dialog.wt.name, { force: true });
          }}
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
      {bottomSheetWt && (
        <BottomSheet
          open
          title={bottomSheetWt.branch ?? bottomSheetWt.name}
          onClose={() => setBottomSheetWt(null)}
        >
          <BottomSheetItem
            onClick={() => {
              openWorktreeInChat(projectCwd, bottomSheetWt.path, true);
              setBottomSheetWt(null);
            }}
          >
            Open new chat
          </BottomSheetItem>
          <BottomSheetItem
            onClick={() => {
              setDialog({ kind: 'rename', wt: bottomSheetWt });
              setBottomSheetWt(null);
            }}
          >
            Rename
          </BottomSheetItem>
          <BottomSheetItem
            onClick={() => {
              setDialog({ kind: 'archive', wt: bottomSheetWt, dirty: false });
              setBottomSheetWt(null);
            }}
          >
            Archive
          </BottomSheetItem>
          <BottomSheetItem
            variant="destructive"
            onClick={() => {
              setDialog({
                kind: 'remove',
                wt: bottomSheetWt,
                activeCount: sessionsByPath.get(bottomSheetWt.path)?.length ?? 0,
              });
              setBottomSheetWt(null);
            }}
          >
            Delete
          </BottomSheetItem>
          <BottomSheetItem
            onClick={() => {
              void navigator.clipboard?.writeText(bottomSheetWt.path);
              setBottomSheetWt(null);
            }}
          >
            Copy path
          </BottomSheetItem>
        </BottomSheet>
      )}
    </div>
  );
}
