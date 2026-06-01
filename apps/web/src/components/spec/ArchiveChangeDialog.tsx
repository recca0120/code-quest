import { useState } from 'react';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';
import { DialogFooter } from '../ui/DialogFooter.tsx';
import { InlineCode } from '../ui/InlineCode.tsx';

interface ArchiveChangeDialogProps {
  open: boolean;
  name: string;
  onSubmit: (opts: { skipSpecs: boolean }) => void | Promise<void>;
  onClose: () => void;
}

export function ArchiveChangeDialog({
  open,
  name,
  onSubmit,
  onClose,
}: ArchiveChangeDialogProps): React.JSX.Element {
  const [skipSpecs, setSkipSpecs] = useState(false);

  function reset() {
    setSkipSpecs(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent title="Archive change" size="md">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">
            Archive <span className="font-mono text-text">{name}</span>?
          </p>
          <p className="text-xs text-dim leading-relaxed">
            This moves the change to <InlineCode subtle>openspec/changes/archive/</InlineCode> and
            (unless you tick the box below) propagates its delta specs into the main specs tree.
          </p>
          <label className="flex items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={skipSpecs}
              onChange={(e) => setSkipSpecs(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Skip spec update (<InlineCode subtle>--skip-specs</InlineCode>) — for infrastructure /
              tooling / doc-only changes that don't modify specs.
            </span>
          </label>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <ActionButton onClick={() => onSubmit({ skipSpecs })} variant="danger" size="sm">
              Archive
            </ActionButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
