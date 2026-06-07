import { cn } from '@/utils/cn';

type RowActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  'aria-label': string;
  showOnHover?: boolean;
};

export function RowActionButton({
  'aria-label': ariaLabel,
  onClick,
  children,
  className,
  showOnHover,
  ...rest
}: RowActionButtonProps): React.JSX.Element {
  return (
    <button
      {...rest}
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        'relative z-10 shrink-0 px-1 text-muted hover:text-text',
        showOnHover && 'lg:opacity-0 lg:group-hover:opacity-100',
        className,
      )}
    >
      {children}
    </button>
  );
}
