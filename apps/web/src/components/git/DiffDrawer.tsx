import { useEffect, useState } from 'react';
import { RightDrawer } from '@/components/ui/RightDrawer.tsx';
import { copyToClipboard } from '@/utils/clipboard';
import { cn } from '@/utils/cn';
import type { DiffFile } from '@/utils/parse-unified-diff';
import { Button } from '../ui/Button.tsx';

const LINE_LIMIT = 5000;
const CONFIRM_WINDOW_MS = 3000;

const KIND_CLASS = {
  add: 'text-success bg-success/10',
  del: 'text-danger bg-danger/10',
  hunk: 'text-muted bg-bg/40',
  header: 'text-muted',
  meta: 'text-dim',
  context: 'text-text',
} as const;

type DiffDrawerProps =
  | { open: false; onClose: () => void; file?: never; canDiscard?: never; onDiscard?: never }
  | {
      open: true;
      file: DiffFile;
      canDiscard?: boolean;
      onClose: () => void;
      onDiscard?: () => void | Promise<void>;
    };

export function DiffDrawer({
  open,
  file,
  canDiscard = true,
  onClose,
  onDiscard,
}: DiffDrawerProps): React.JSX.Element {
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    if (!pendingConfirm) return;
    const timer = setTimeout(() => setPendingConfirm(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [pendingConfirm]);

  if (!open) {
    return (
      <RightDrawer
        open={false}
        title=""
        width={672}
        onClose={onClose}
        overlayTestId="diff-drawer-overlay"
      >
        {null}
      </RightDrawer>
    );
  }

  async function handleDiscard() {
    if (!pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    await onDiscard?.();
    setPendingConfirm(false);
  }

  const title = `${file.path}  +${file.added} -${file.removed}`;
  const truncated = file.lines.length > LINE_LIMIT;
  const lines = truncated ? file.lines.slice(0, LINE_LIMIT) : file.lines;

  const footer = (
    <>
      <Button variant="secondary" size="sm" onClick={() => void copyToClipboard(file.path)}>
        Copy path
      </Button>
      {onDiscard && (
        <Button
          variant="secondary"
          size="sm"
          disabled={!canDiscard}
          title={!canDiscard ? 'New file — delete via file tree' : undefined}
          className={pendingConfirm ? 'bg-danger/20 text-danger' : undefined}
          onClick={() => void handleDiscard()}
        >
          {pendingConfirm ? 'Confirm?' : 'Discard'}
        </Button>
      )}
    </>
  );

  return (
    <RightDrawer
      open={open}
      title={title}
      width={672}
      onClose={onClose}
      footer={footer}
      overlayTestId="diff-drawer-overlay"
    >
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {file.isBinary ? (
          <div className="text-sm text-muted">Binary file changed.</div>
        ) : (
          <pre className="text-xs bg-bg/40 border border-border rounded p-2 overflow-auto font-mono leading-relaxed">
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
      </div>
    </RightDrawer>
  );
}
