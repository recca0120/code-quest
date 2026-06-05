import * as RadixDialog from '@radix-ui/react-dialog';
import { type ReactNode, useCallback, useRef } from 'react';
import { ResizeHandle } from '../files/ResizeHandle.tsx';

const MIN_WIDTH = 320;
const MAX_WIDTH_RATIO = 0.8;

interface RightDrawerProps {
  open: boolean;
  title: ReactNode;
  defaultWidth?: number;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function RightDrawer({
  open,
  title,
  defaultWidth = 560,
  onClose,
  children,
  footer,
}: RightDrawerProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback((clientX: number) => {
    const el = contentRef.current;
    if (!el) return;
    const maxWidth = Math.floor(window.innerWidth * MAX_WIDTH_RATIO);
    const next = Math.min(Math.max(window.innerWidth - clientX, MIN_WIDTH), maxWidth);
    el.style.width = `${next}px`;
  }, []);

  return (
    <RadixDialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-overlay bg-overlay" />
        <RadixDialog.Content
          ref={contentRef}
          className="fixed inset-y-0 right-0 z-modal bg-surface border-l border-border flex flex-col"
          style={{ width: defaultWidth }}
        >
          <ResizeHandle
            onResize={handleResize}
            className="absolute left-0 top-0 bottom-0 w-1 hover:bg-accent/50 active:bg-accent"
          />
          <RadixDialog.Title className="flex items-center gap-2 px-4 py-3 border-b border-border text-sm font-medium shrink-0">
            {typeof title === 'string' ? <span className="flex-1 truncate">{title}</span> : title}
          </RadixDialog.Title>
          {children}
          {footer && (
            <div className="flex gap-2 px-4 py-3 border-t border-border shrink-0">{footer}</div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
