import { useDrag } from '@use-gesture/react';
import { cn } from '@/utils/cn';

interface ResizeHandleProps {
  onResize: (clientX: number) => void;
  className?: string;
}

export function ResizeHandle({ onResize, className }: ResizeHandleProps): React.JSX.Element {
  const bind = useDrag(({ xy: [x] }) => onResize(x));

  return (
    <div data-testid="resize-handle" className={cn('cursor-col-resize', className)} {...bind()} />
  );
}
