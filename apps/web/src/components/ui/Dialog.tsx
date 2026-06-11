import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export const Dialog: typeof RadixDialog.Root = RadixDialog.Root;
export const DialogClose: typeof RadixDialog.Close = RadixDialog.Close;

type DialogSize = 'md' | 'lg' | 'picker' | 'palette' | 'fullscreen';

interface DialogContentProps {
  children: ReactNode;
  className?: string;
  /** When true, prevents closing on overlay click and Escape */
  mandatory?: boolean;
  title: string;
  hideTitle?: boolean;
  hideTitleDivider?: boolean;
  size?: DialogSize;
  /** When false, disables overflow-y-auto so inner content can manage its own scrollbar. Default true. */
  scrollable?: boolean;
  /** Portal target. When set, overlay + content render inside the given
   *  element (which SHOULD be `position: relative`) instead of document.body
   *  — use for dialogs scoped to a panel region (e.g. ChatShell). */
  container?: HTMLElement | null;
}

const SIZE_CLASSES: Record<DialogSize, string> = {
  md: 'dialog-viewport p-4',
  lg: 'w-160 dialog-viewport p-4',
  // PanePicker（handoff §4）：寬 980（<lg 退 560 單欄堆疊）、圓角 14 僅此變體
  picker:
    'w-(--picker-w-sm) lg:w-(--picker-w-lg) dialog-viewport p-4 rounded-(--radius-composer) animate-palette-in',
  // unified-command-entry：指令模式／訊息搜尋模式（640px）
  palette: 'w-(--palette-w) dialog-viewport p-4 rounded-(--radius-composer) animate-palette-in',
  fullscreen: 'w-screen h-screen max-w-none max-h-none p-0 rounded-none border-0',
};

export function DialogContent({
  children,
  className = '',
  mandatory = false,
  title,
  hideTitle = false,
  hideTitleDivider = false,
  size = 'md',
  scrollable = true,
  container,
}: DialogContentProps): React.JSX.Element {
  // When portaled into a scoped container, position with `absolute` instead
  // of `fixed` so overlay + content are bounded by that container's box.
  const scoped = container != null;
  const overlayPos = scoped ? 'absolute inset-0' : 'fixed inset-0';
  const contentPos = `${scoped ? 'absolute' : 'fixed'} z-modal left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`;

  return (
    <RadixDialog.Portal container={container ?? undefined}>
      <RadixDialog.Overlay className={cn(overlayPos, 'z-modal bg-overlay')} />
      <RadixDialog.Content
        className={cn(
          contentPos,
          'bg-surface text-text border border-border rounded-(--radius-card) shadow-floating outline-none',
          scrollable ? 'overflow-y-auto' : 'overflow-hidden flex flex-col',
          SIZE_CLASSES[size],
          className,
        )}
        onEscapeKeyDown={mandatory ? (e) => e.preventDefault() : undefined}
        onPointerDownOutside={mandatory ? (e) => e.preventDefault() : undefined}
        onInteractOutside={mandatory ? (e) => e.preventDefault() : undefined}
        aria-describedby={undefined}
      >
        <RadixDialog.Title
          className={
            hideTitle
              ? 'sr-only'
              : cn(
                  'text-[length:var(--text-body)] font-semibold text-text mb-3',
                  hideTitleDivider ? '' : 'pb-2 border-b border-border',
                )
          }
        >
          {title}
        </RadixDialog.Title>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
