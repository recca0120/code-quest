import { useState } from 'react';
import { TextField } from '@/components/chat/ui/TextField';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';
import { DialogFooter } from '../ui/DialogFooter.tsx';

const VALID_NAME = /^[\w.\-+]+$/;

interface NewEntryDialogProps {
  open: boolean;
  kind: 'file' | 'directory';
  /** Directory the new entry will be created inside (for the title text). */
  parentLabel: string;
  onSubmit: (name: string) => void | Promise<void>;
  onClose: () => void;
}

export function NewEntryDialog({
  open,
  kind,
  parentLabel,
  onSubmit,
  onClose,
}: NewEntryDialogProps): React.JSX.Element {
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
    if (!VALID_NAME.test(trimmed)) {
      setError('Letters, digits, dot, dash, underscore, plus only');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  const title = kind === 'directory' ? 'New folder' : 'New file';
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
      <DialogContent title={title} size="md">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-dim">
            In <span className="font-mono text-text">{parentLabel}</span>
          </p>
          <label className="text-xs text-muted" htmlFor="new-entry-name">
            Name
            <TextField
              id="new-entry-name"
              type="text"
              value={name}
              autoFocus
              mono
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
