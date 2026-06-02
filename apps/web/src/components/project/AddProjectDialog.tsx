import { useState } from 'react';
import { FileTree } from '../files/FileTree.tsx';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogClose, DialogContent } from '../ui/Dialog.tsx';
import { DialogFooter } from '../ui/DialogFooter.tsx';
import { XIcon } from '../ui/Icons.tsx';

export function AddProjectDialog({
  open,
  onSelect,
  onClose,
  addedProjectCwds,
}: {
  open: boolean;
  onSelect: (cwd: string) => void;
  onClose: () => void;
  /** Absolute cwds already tracked as projects — rendered disabled so the
   *  user can't pick a duplicate. */
  addedProjectCwds?: ReadonlySet<string>;
}): React.JSX.Element {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  function handleAdd() {
    if (selectedPath) {
      onSelect(selectedPath);
      onClose();
      setSelectedPath(null);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedPath(null);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent title="Select Project Directory" className="w-120 max-h-[70vh] flex flex-col">
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="absolute top-3 right-3 p-1 text-muted hover:text-text hover:bg-hover-tint rounded"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </DialogClose>
        {selectedPath && (
          <div className="-mx-4 px-4 py-1.5 text-xs text-muted truncate border-b border-border bg-bg/30 mb-2">
            {selectedPath}
          </div>
        )}
        <div className="flex-1 overflow-auto min-h-50">
          <FileTree
            highlightedPath={selectedPath}
            onHighlight={setSelectedPath}
            disabledPaths={addedProjectCwds}
            onSelect={(path) => {
              onSelect(path);
              onClose();
              setSelectedPath(null);
            }}
          />
        </div>
        <DialogFooter variant="bleed" className="mt-3">
          <DialogClose asChild>
            <Button variant="secondary" size="md">
              Cancel
            </Button>
          </DialogClose>
          <Button size="md" disabled={!selectedPath} onClick={handleAdd}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
