import { useState } from 'react';
import { MIN_H, MIN_W } from './pane-min-size';

interface PaneDividerProps {
  direction: 'h' | 'v';
  onRatioChange: (ratio: number) => void;
  /** 目前 split ratio——拖曳以此為起點（未提供時視為 50%） */
  ratio?: number;
  containerSize?: number;
}

export function PaneDivider({
  direction,
  onRatioChange,
  ratio = 0.5,
  containerSize,
}: PaneDividerProps): React.JSX.Element {
  const isHorizontal = direction === 'h';
  // 拖曳中（pointerdown→up）持續 accent-soft 底——pointer capture 下 :hover 不可靠
  const [isResizing, setIsResizing] = useState(false);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizing(true);
    const startPos = isHorizontal ? e.clientX : e.clientY;
    const startRatio = ratio;
    const parent = e.currentTarget.parentElement;
    const totalSize =
      containerSize ?? (parent ? (isHorizontal ? parent.offsetWidth : parent.offsetHeight) : 1);

    function handleMove(moveEvent: PointerEvent) {
      const currentPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      // 下限與 split 最小尺寸同源（決策 10）：h 向 --pane-min-w、v 向 --pane-min-h
      const minPx = isHorizontal ? MIN_W : MIN_H;
      const minRatio = totalSize > 0 ? minPx / totalSize : 0.1;
      const maxRatio = totalSize > 0 ? (totalSize - minPx) / totalSize : 0.9;
      // 以拖曳起點的 ratio 起算（非固定 0.5）——連續拖不會跳回 50%
      const next = Math.max(minRatio, Math.min(maxRatio, startRatio + delta / totalSize));
      onRatioChange(next);
    }

    function handleUp() {
      setIsResizing(false);
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
      data-resizing={isResizing || undefined}
      onPointerDown={handlePointerDown}
      onDoubleClick={() => onRatioChange(0.5)}
      title="拖曳調整大小・雙擊回 50%"
      className={`group relative flex-shrink-0 flex items-center justify-center transition-colors hover:bg-accent/10 data-[resizing]:bg-accent/10 ${
        isHorizontal ? 'cursor-col-resize w-(--pane-gap)' : 'cursor-row-resize h-(--pane-gap)'
      }`}
    >
      {/* 視覺 1px、熱區 6px（handoff §7）——熱區同時是 pane 間距；hover 加粗 2px＋accent */}
      <span
        aria-hidden="true"
        className={`bg-border group-hover:bg-accent ${
          isHorizontal ? 'w-px h-full group-hover:w-0.5' : 'h-px w-full group-hover:h-0.5'
        }`}
      />
      {/* 中央把手 ⋮（hover 顯示，handoff §7） */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute hidden group-hover:block text-xs leading-none text-accent ${
          isHorizontal ? '' : 'rotate-90'
        }`}
      >
        ⋮
      </span>
    </div>
  );
}
