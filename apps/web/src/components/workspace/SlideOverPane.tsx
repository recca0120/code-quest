import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 100;

interface SlideOverPaneProps {
  children: React.ReactNode;
  visible?: boolean;
  onSwipeClose?: () => void;
  onPinToSplit?: () => void;
}

export function SlideOverPane({
  children,
  visible = true,
  onSwipeClose,
  onPinToSplit,
}: SlideOverPaneProps): React.JSX.Element | null {
  const startXRef = useRef<number | null>(null);
  const deltaXRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  if (!visible) return null;

  function handlePointerDown(e: React.PointerEvent) {
    startXRef.current = e.clientX;
    deltaXRef.current = 0;
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startXRef.current === null) return;
    deltaXRef.current = e.clientX - startXRef.current;
    setDragOffset(Math.max(0, deltaXRef.current));
  }

  function handlePointerUp() {
    if (startXRef.current !== null) {
      if (deltaXRef.current > SWIPE_THRESHOLD) {
        onSwipeClose?.();
      } else if (deltaXRef.current < -SWIPE_THRESHOLD) {
        onPinToSplit?.();
      }
    }
    startXRef.current = null;
    deltaXRef.current = 0;
    setDragOffset(0);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: slide-over gesture handler — swipe to dismiss
    <div
      data-testid="slide-over-pane"
      style={{
        width: 'var(--slideover-w)',
        transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
      }}
      className="absolute right-2.5 top-2.5 bottom-2.5 z-float flex flex-col bg-bg border border-border rounded-(--radius-mobile-card) shadow-floating animate-slide-over-in"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {children}
    </div>
  );
}
