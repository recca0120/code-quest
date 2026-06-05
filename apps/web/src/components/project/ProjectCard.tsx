import { FolderIcon, StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import * as Popover from '@radix-ui/react-popover';
import { useContext, useState } from 'react';
import { NavigationActionsContext } from '@/contexts/NavigationContext';
import { ProjectActionsContext } from '@/contexts/ProjectContext';
import { SessionStateContext } from '@/contexts/SessionContext';
import { basename } from '@/utils/basename';
import { copyToClipboard } from '@/utils/clipboard';
import { cn } from '@/utils/cn';
import { SessionHistoryPopover } from '../chat/session/SessionHistoryPopover.tsx';
import { CreateWorktreeDialog } from './CreateWorktreeDialog.tsx';
import {
  ProjectContextMenu,
  ProjectDropdownMenu,
  type ProjectMenuCallbacks,
} from './ProjectContextMenu.tsx';
import { RemoveProjectConfirmDialog } from './RemoveProjectConfirmDialog.tsx';
import { RenameProjectDialog } from './RenameProjectDialog.tsx';

/** Display name preferring basename when name still looks like a full path
 *  (legacy data backfilled before basename extraction was applied). */
function displayName(name: string, cwd?: string): string {
  if (name.includes('/')) return basename(name);
  if (!name && cwd) return basename(cwd);
  return name;
}

export function ProjectCard({
  name,
  cwd,
  active,
  pinned = false,
  onSelect,
  onSelectInitRepo,
}: {
  name: string;
  cwd?: string;
  active: boolean;
  pinned?: boolean;
  onSelect: () => void;
  /** Only passed for non-git projects — when present, ⋯ menu shows "Initialize as git repo". */
  onSelectInitRepo?: () => void;
}): React.JSX.Element {
  type Dialog = 'resume' | 'worktree' | 'rename' | 'remove' | null;
  const [openDialog, setOpenDialog] = useState<Dialog>(null);
  const closeDialog = () => setOpenDialog(null);

  const actions = useContext(ProjectActionsContext);
  const navActions = useContext(NavigationActionsContext);
  const sessionState = useContext(SessionStateContext);

  const handleResumed = (spawnedId: string, picked: { cwd?: string }) => {
    const targetCwd = picked.cwd ?? cwd;
    if (targetCwd) {
      actions?.setActiveProject(targetCwd);
      navActions?.requestActivateChannel(targetCwd, spawnedId);
    }
  };

  const menuCallbacks: ProjectMenuCallbacks = {
    onSelectResume: () => setOpenDialog('resume'),
    onSelectCreateWorktree: () => setOpenDialog('worktree'),
    onCopyPath: cwd ? () => void copyToClipboard(cwd) : undefined,
    onSelectRename: actions && cwd ? () => setOpenDialog('rename') : undefined,
    onSelectRemove: actions && cwd ? () => setOpenDialog('remove') : undefined,
    onSelectInitRepo: onSelectInitRepo,
  };

  function handleTogglePin(e: React.MouseEvent) {
    e.stopPropagation();
    if (!cwd || !actions) return;
    actions.pinProject(cwd, !pinned);
  }

  const activeSessionCount = cwd
    ? (sessionState?.sessions ?? []).filter((s) => s.projectRoot === cwd && s.state !== 'exited')
        .length
    : 0;

  const label = displayName(name, cwd);

  return (
    <>
      <Popover.Root
        open={openDialog === 'resume'}
        onOpenChange={(v) => setOpenDialog(v ? 'resume' : null)}
      >
        <ProjectContextMenu disabled={!cwd} {...menuCallbacks}>
          <Popover.Anchor asChild>
            <div
              data-active={active}
              className={cn(
                'group relative my-0.5 rounded',
                active ? 'bg-accent/10' : 'hover:bg-hover-tint',
              )}
            >
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 text-xs w-full min-w-0 text-left',
                  active ? 'text-text' : 'text-muted group-hover:text-text',
                  actions && cwd ? 'pr-12' : '',
                )}
                title={cwd ?? label}
                onClick={onSelect}
              >
                <FolderIcon className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 font-medium">{label}</span>
              </button>
              {actions && cwd ? (
                <div className="absolute top-1/2 -translate-y-1/2 right-1 flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={pinned ? 'Unpin' : 'Pin'}
                    title={pinned ? 'Unpin' : 'Pin'}
                    data-pinned={pinned}
                    onClick={handleTogglePin}
                    className={cn(
                      'shrink-0 p-0.5 rounded hover:text-text',
                      pinned ? 'text-accent' : 'text-muted opacity-0 group-hover:opacity-100',
                    )}
                  >
                    {pinned ? (
                      <StarSolid className="w-3.5 h-3.5" />
                    ) : (
                      <StarOutline className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <ProjectDropdownMenu
                    trigger={
                      <button
                        type="button"
                        aria-label="More actions"
                        title="More"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 px-1 text-muted hover:text-text opacity-0 group-hover:opacity-100"
                      >
                        ⋯
                      </button>
                    }
                    {...menuCallbacks}
                  />
                </div>
              ) : null}
            </div>
          </Popover.Anchor>
        </ProjectContextMenu>
        {cwd && openDialog === 'resume' && (
          <SessionHistoryPopover cwd={cwd} onClose={closeDialog} onResumed={handleResumed} />
        )}
      </Popover.Root>
      {cwd && openDialog === 'worktree' && (
        <CreateWorktreeDialog open cwd={cwd} onClose={closeDialog} />
      )}
      {actions && cwd && (
        <RenameProjectDialog
          open={openDialog === 'rename'}
          currentName={label}
          onRename={(newName) => {
            actions.renameProject(cwd, newName);
          }}
          onClose={closeDialog}
        />
      )}
      {actions && cwd && (
        <RemoveProjectConfirmDialog
          open={openDialog === 'remove'}
          projectName={label}
          activeSessionCount={activeSessionCount}
          onConfirm={() => {
            actions.removeProject(cwd);
          }}
          onClose={closeDialog}
        />
      )}
    </>
  );
}
