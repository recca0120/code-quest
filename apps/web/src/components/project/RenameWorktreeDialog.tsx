import { useEffect, useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';
import { DialogFooter } from '../ui/DialogFooter.tsx';

const VALID_NAME = /^[\w./-]+$/;

interface RenameWorktreeDialogProps {
  open: boolean;
  currentBranch: string;
  onSubmit: (newName: string) => void;
  onClose: () => void;
}

export function RenameWorktreeDialog({
  open,
  currentBranch,
  onSubmit,
  onClose,
}: RenameWorktreeDialogProps): React.JSX.Element {
  const [name, setName] = useState(currentBranch);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setName(currentBranch);
  }, [open, currentBranch]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Branch name is required');
      return;
    }
    if (!VALID_NAME.test(trimmed)) {
      setError('Only letters, digits, dot, dash, slash, underscore allowed');
      return;
    }
    if (trimmed === currentBranch) {
      onClose();
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Rename branch" size="md">
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted">
            New branch name
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              className="mt-1 w-full px-2 py-1 rounded border border-border bg-bg/40 text-sm text-text font-mono"
            />
          </label>
          {error && <p className="text-xs text-warning">{error}</p>}
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit}>
              Rename
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
