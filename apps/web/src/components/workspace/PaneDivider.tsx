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
      const minPx = 200;
      const minRatio = totalSize > 0 ? minPx / totalSize : 0.1;
      const maxRatio = totalSize > 0 ? (totalSize - minPx) / totalSize : 0.9;
      const ratio = Math.max(minRatio, Math.min(maxRatio, 0.5 + delta / totalSize));
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
    // biome-ignore lint/a11y/noStaticElementInteractions: resize 拖曳把手——鍵盤等效為 focused pane 的 ⌥方向鍵微調（KeyboardShortcutsProvider）
    <div
      data-testid="pane-divider"
      data-direction={direction}
      onPointerDown={handlePointerDown}
      onDoubleClick={() => onRatioChange(0.5)}
      title="拖曳調整大小・雙擊回 50%"
      className={`flex-shrink-0 bg-border hover:bg-accent/40 transition-colors cursor-${isHorizontal ? 'col' : 'row'}-resize ${isHorizontal ? 'w-1' : 'h-1'}`}
    />
  );
}
