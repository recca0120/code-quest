import { pluralize } from '@/utils/pluralize';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';

function BlockedContent({
  branch,
  activeSessionCount,
  onClose,
}: {
  branch: string;
  activeSessionCount: number;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text">
        Worktree <span className="font-semibold">{branch}</span> has{' '}
        <span className="text-warning font-semibold">
          {pluralize(activeSessionCount, 'active session')}
        </span>
        . Close them first before deleting the worktree.
      </p>
      <div className="flex justify-end">
        <Button onClick={onClose} type="button">
          OK
        </Button>
      </div>
    </div>
  );
}

function AllowedContent({
  branch,
  onConfirm,
  onClose,
}: {
  branch: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text">
        Delete worktree <span className="font-semibold">{branch}</span>?
      </p>
      <p className="text-xs text-muted">
        This runs <code>git worktree remove</code>. The worktree folder will be deleted.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} type="button">
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} type="button">
          Delete
        </Button>
      </div>
    </div>
  );
}

export function RemoveWorktreeConfirmDialog({
  open,
  branch,
  activeSessionCount,
  onConfirm,
  onClose,
}: {
  open: boolean;
  branch: string;
  activeSessionCount: number;
  onConfirm: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const blocked = activeSessionCount > 0;

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={blocked ? 'Cannot delete worktree' : 'Delete worktree'}
        className="w-96"
      >
        {blocked ? (
          <BlockedContent
            branch={branch}
            activeSessionCount={activeSessionCount}
            onClose={onClose}
          />
        ) : (
          <AllowedContent branch={branch} onConfirm={handleConfirm} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
