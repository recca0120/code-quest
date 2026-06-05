import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { IconButton } from './IconButton';
import { XIcon } from './Icons';

interface DrawerAsideProps {
  side: 'left' | 'right';
  open: boolean;
  mobileWidthClass: string;
  dockedWidthClass: string;
  label: string;
  closeLabel?: string;
  onClose?: () => void;
  children: ReactNode;
}

export function DrawerAside({
  side,
  open,
  mobileWidthClass,
  dockedWidthClass,
  label,
  closeLabel,
  onClose,
  children,
}: DrawerAsideProps): React.JSX.Element {
  const isLeft = side === 'left';
  return (
    <aside
      aria-label={label}
      data-open={open || undefined}
      className={cn(
        'fixed inset-y-0 z-modal bg-surface',
        isLeft ? 'left-0 border-r border-border' : 'right-0 border-l border-border',
        mobileWidthClass,
        'transition-transform duration-150 ease-out',
        !open && (isLeft ? '-translate-x-full' : 'translate-x-full'),
        'lg:static lg:translate-x-0 lg:shrink-0 lg:transition-[width] lg:duration-200',
        dockedWidthClass,
        !open && 'lg:w-0 lg:overflow-hidden',
      )}
    >
      {onClose && (
        <div className="flex justify-end p-2 lg:hidden">
          <IconButton aria-label={`close ${closeLabel ?? label}`} onClick={onClose}>
            <XIcon className="w-5 h-5" />
          </IconButton>
        </div>
      )}
      <div className="h-full overflow-auto">{children}</div>
    </aside>
  );
}
