import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';
import { DialogFooter } from '../ui/DialogFooter.tsx';

interface ArchiveWorktreeConfirmDialogProps {
  open: boolean;
  branch: string;
  /** Set when a previous archive attempt failed with `error: 'dirty'`. */
  dirty?: boolean;
  onConfirm: (opts: { force: boolean }) => void;
  onClose: () => void;
}

export function ArchiveWorktreeConfirmDialog({
  open,
  branch,
  dirty = false,
  onConfirm,
  onClose,
}: ArchiveWorktreeConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Archive worktree" size="md">
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Archive <span className="font-mono font-semibold">{branch}</span>?
          </p>
          <p className="text-xs text-muted">
            Removes the worktree directory but keeps the branch ref. You can re-add it later with{' '}
            <code>git worktree add</code>.
          </p>
          {dirty && (
            <p className="text-xs text-warning">
              Worktree has uncommitted changes. Force-archive will discard them.
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {dirty ? (
              <Button variant="danger" size="sm" onClick={() => onConfirm({ force: true })}>
                Force archive
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => onConfirm({ force: false })}>
                Archive
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
