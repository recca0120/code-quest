import { forwardRef, type ReactNode, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { cn } from '@/utils/cn';

interface RewindConfirmDialogProps {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}

export function RewindConfirmDialog({
  open,
  title,
  onConfirm,
  onCancel,
  children,
}: RewindConfirmDialogProps): React.JSX.Element {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => confirmRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key === 'Enter' || e.key === '1') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === '2') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent title={title} hideTitleDivider className="w-112 max-w-[90vw]">
        <div className="mb-3 flex flex-col gap-2 text-sm text-muted">{children}</div>
        <div className="flex flex-col gap-1">
          <NumberedButton
            ref={confirmRef}
            variant="primary"
            shortcut="1"
            label="Continue"
            onClick={onConfirm}
            onKeyDown={onKeyDown}
          />
          <NumberedButton
            variant="secondary"
            shortcut="2"
            label="Never mind"
            onClick={onCancel}
            onKeyDown={onKeyDown}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface NumberedButtonProps {
  variant: 'primary' | 'secondary';
  shortcut: string;
  label: string;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const NumberedButton = forwardRef<HTMLButtonElement, NumberedButtonProps>(
  ({ variant, shortcut, label, onClick, onKeyDown }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        'w-full flex items-baseline gap-2 px-3 py-1 rounded text-xs text-left',
        variant === 'primary'
          ? 'bg-accent text-selected-text hover:bg-accent/90'
          : 'text-text hover:bg-hover-tint',
      )}
    >
      <span aria-hidden="true" className={cn('shrink-0', variant === 'secondary' && 'text-muted')}>
        {shortcut}
      </span>
      <span className={variant === 'primary' ? 'font-semibold' : undefined}>{label}</span>
    </button>
  ),
);
