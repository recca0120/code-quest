interface ClickableRowOverlayProps {
  'aria-label': string;
  onClick: () => void;
}

export function ClickableRowOverlay({
  'aria-label': ariaLabel,
  onClick,
}: ClickableRowOverlayProps): React.JSX.Element {
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className="absolute inset-0" />
  );
}
