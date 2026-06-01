import { useState } from 'react';
import { TextField } from '@/components/chat/ui/TextField';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';
import { DialogFooter } from '../ui/DialogFooter.tsx';
import { InlineCode } from '../ui/InlineCode.tsx';

const VALID_SLUG = /^[a-z0-9-]+$/;

interface NewChangeDialogProps {
  open: boolean;
  onSubmit: (name: string) => void | Promise<void>;
  onClose: () => void;
}

export function NewChangeDialog({
  open,
  onSubmit,
  onClose,
}: NewChangeDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName('');
    setError(null);
    setSubmitting(false);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    if (!VALID_SLUG.test(trimmed)) {
      setError('Only lowercase letters, digits, and hyphens');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
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
      <DialogContent title="New OpenSpec change" size="md">
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted" htmlFor="new-change-name">
            Change name (slug)
            <TextField
              id="new-change-name"
              type="text"
              value={name}
              autoFocus
              mono
              placeholder="e.g. add-dark-mode"
              onChange={(value) => {
                setName(value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              className="mt-1 w-full"
            />
          </label>
          <p className="text-xs text-dim">
            Runs <InlineCode subtle>openspec change new &lt;name&gt;</InlineCode>.
          </p>
          {error && <p className="text-xs text-warning">{error}</p>}
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={submitting} onClick={() => void submit()}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
