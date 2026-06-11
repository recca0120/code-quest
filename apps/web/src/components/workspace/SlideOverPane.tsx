interface SlideOverPaneProps {
  children: React.ReactNode;
  visible?: boolean;
  onSwipeClose?: () => void;
}

export function SlideOverPane({
  children,
  visible = true,
}: SlideOverPaneProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <div
      data-testid="slide-over-pane"
      style={{ width: '58%' }}
      className="absolute right-0 top-0 bottom-0 z-25 flex flex-col bg-surface border-l border-border rounded-l-(--radius-card) shadow-floating animate-slide-over-in"
    >
      {children}
    </div>
  );
}
