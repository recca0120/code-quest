interface PaneDividerProps {
  direction: 'h' | 'v';
  onRatioChange: (ratio: number) => void;
  containerSize?: number;
}

export function PaneDivider({
  direction,
  onRatioChange,
  containerSize,
}: PaneDividerProps): React.JSX.Element {
  const isHorizontal = direction === 'h';

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const startPos = isHorizontal ? e.clientX : e.clientY;
    const parent = e.currentTarget.parentElement;
    const totalSize =
      containerSize ?? (parent ? (isHorizontal ? parent.offsetWidth : parent.offsetHeight) : 1);

    function handleMove(moveEvent: PointerEvent) {
      const currentPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const ratio = Math.max(0.1, Math.min(0.9, 0.5 + delta / totalSize));
      onRatioChange(ratio);
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }

  return (
    <div
      data-testid="pane-divider"
      data-direction={direction}
      onPointerDown={handlePointerDown}
      className={`flex-shrink-0 bg-border hover:bg-primary/40 transition-colors cursor-${isHorizontal ? 'col' : 'row'}-resize ${isHorizontal ? 'w-1' : 'h-1'}`}
    />
  );
}
