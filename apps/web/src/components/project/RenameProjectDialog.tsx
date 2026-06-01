import { useEffect, useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';

export function RenameProjectDialog({
  open,
  currentName,
  onRename,
  onClose,
}: {
  open: boolean;
  currentName: string;
  onRename: (name: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [value, setValue] = useState(currentName);

  useEffect(() => {
    if (open) setValue(currentName);
  }, [open, currentName]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== currentName;

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!canSubmit) return;
    onRename(trimmed);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent title="Rename project" className="w-96">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted text-xs">New name</span>
            <input
              type="text"
              aria-label="New name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-border bg-bg text-text outline-none focus:border-accent"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Rename
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
