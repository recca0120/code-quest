import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps): React.JSX.Element {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-overlay bg-overlay" />
        <RadixDialog.Content
          aria-label={title ?? 'bottom-sheet'}
          className="fixed bottom-0 left-0 right-0 z-modal bg-surface rounded-t-xl border-t border-border flex flex-col"
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-border" aria-hidden />
          </div>
          {title && (
            <div className="px-4 py-2 border-b border-border">
              <RadixDialog.Title className="text-sm font-medium text-text">
                {title}
              </RadixDialog.Title>
            </div>
          )}
          {!title && <RadixDialog.Title className="sr-only">bottom-sheet</RadixDialog.Title>}
          <div className="flex flex-col py-1 overflow-y-auto max-h-[70vh]">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

interface BottomSheetItemProps {
  onClick: () => void;
  variant?: 'default' | 'destructive';
  children: ReactNode;
}

export function BottomSheetItem({
  onClick,
  variant = 'default',
  children,
}: BottomSheetItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-hover-tint',
        variant === 'destructive' ? 'text-danger' : 'text-text',
      )}
    >
      {children}
    </button>
  );
}
