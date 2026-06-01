import { cn } from '@/utils/cn';

export function OptionButton({
  index,
  label,
  selected = false,
  onClick,
  onMouseEnter,
}: {
  index: number;
  label: string;
  selected?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full text-left px-4 py-2 text-xs flex items-center gap-2 cursor-pointer transition-colors',
        selected ? 'bg-accent text-selected-text' : 'hover:bg-hover-tint',
      )}
    >
      <span
        className={cn('w-4 text-center shrink-0', selected ? 'text-selected-text' : 'text-muted')}
      >
        {index}
      </span>
      <span>{label}</span>
    </button>
  );
}
