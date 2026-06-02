import { pluralize } from '@/utils/pluralize';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';

function BlockedContent({
  projectName,
  activeSessionCount,
  onClose,
}: {
  projectName: string;
  activeSessionCount: number;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text">
        <span className="font-semibold">{projectName}</span> has{' '}
        <span className="text-warning font-semibold">
          {pluralize(activeSessionCount, 'active session')}
        </span>
        . Close them first before removing the project.
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
  projectName,
  onConfirm,
  onClose,
}: {
  projectName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text">
        Remove <span className="font-semibold">{projectName}</span> from your project list?
      </p>
      <p className="text-xs text-muted">
        The folder on disk is <span className="font-semibold">not</span> deleted — only the project
        entry in code-quest.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} type="button">
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} type="button">
          Remove
        </Button>
      </div>
    </div>
  );
}

export function RemoveProjectConfirmDialog({
  open,
  projectName,
  activeSessionCount,
  onConfirm,
  onClose,
}: {
  open: boolean;
  projectName: string;
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
      <DialogContent title={blocked ? 'Cannot remove project' : 'Remove project'} className="w-96">
        {blocked ? (
          <BlockedContent
            projectName={projectName}
            activeSessionCount={activeSessionCount}
            onClose={onClose}
          />
        ) : (
          <AllowedContent projectName={projectName} onConfirm={handleConfirm} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
