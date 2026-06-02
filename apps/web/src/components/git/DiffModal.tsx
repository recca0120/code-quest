import { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';
import type { DiffFile } from '@/utils/parse-unified-diff';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';

/** Diffs over this length get truncated to the same number of head lines —
 *  syntax-highlighting + DOM cost grows linearly past this and modal scroll
 *  becomes unusable. */
const LINE_LIMIT = 5000;
/** Milliseconds the Discard button stays in "Confirm?" state before
 *  reverting to the safe "Discard" label. */
const CONFIRM_WINDOW_MS = 3000;

const KIND_CLASS = {
  add: 'text-success bg-success/10',
  del: 'text-danger bg-danger/10',
  hunk: 'text-muted bg-bg/40',
  header: 'text-muted',
  meta: 'text-dim',
  context: 'text-text',
} as const;

interface DiffModalProps {
  file: DiffFile;
  onClose: () => void;
  /** If provided, a Discard button appears. Clicked once → "Confirm?"
   *  for a short window; second click within the window invokes this. */
  onDiscard?: () => void | Promise<void>;
  /** When false, Discard is rendered disabled (e.g. untracked files —
   *  there's nothing to discard; use file-tree delete instead). */
  canDiscard?: boolean;
}

export function DiffModal({
  file,
  onClose,
  onDiscard,
  canDiscard = true,
}: DiffModalProps): React.JSX.Element {
  const truncated = file.lines.length > LINE_LIMIT;
  const lines = truncated ? file.lines.slice(0, LINE_LIMIT) : file.lines;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  async function handleDiscard() {
    if (!onDiscard) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await onDiscard();
    setConfirming(false);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`${file.path}  +${file.added} -${file.removed}`} size="lg">
        <div className="flex flex-col gap-3">
          {file.isBinary ? (
            <div className="text-sm text-muted">Binary file changed.</div>
          ) : (
            <pre className="text-xs bg-bg/40 border border-border rounded p-2 overflow-auto max-h-dialog-body font-mono leading-relaxed">
              {lines.map((line, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines have no stable id, order is fixed
                  key={i}
                  className={cn('whitespace-pre', KIND_CLASS[line.kind])}
                >
                  {line.text || ' '}
                </div>
              ))}
              {truncated && (
                <div className="text-warning pt-2">
                  Diff truncated ({file.lines.length} lines). Open externally to view full.
                </div>
              )}
            </pre>
          )}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(file.path);
              }}
            >
              Copy path
            </Button>
            {onDiscard && (
              <Button
                variant="secondary"
                size="sm"
                disabled={!canDiscard}
                title={!canDiscard ? 'New file — delete via file tree' : undefined}
                className={confirming ? 'bg-danger/20 text-danger' : undefined}
                onClick={() => void handleDiscard()}
              >
                {confirming ? 'Confirm?' : 'Discard'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
