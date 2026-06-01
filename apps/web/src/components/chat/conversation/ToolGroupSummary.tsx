import { RotatableChevron } from '@/components/ui/Icons';
import type { GroupChip } from '@/utils/timeline-utils';
import { Badge } from '../../ui/Badge.tsx';

interface ToolGroupSummaryProps {
  chips: GroupChip[];
  expanded: boolean;
  onToggle: () => void;
}

export function ToolGroupSummary({
  chips,
  expanded,
  onToggle,
}: ToolGroupSummaryProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 text-xs text-muted hover:text-text cursor-pointer select-none transition-colors w-full text-left"
    >
      <span className="flex items-center gap-1 flex-wrap">
        {chips.length === 0 ? (
          <Badge variant="muted" size="xs">
            Tools
          </Badge>
        ) : (
          chips.map((chip) => (
            <Badge key={chip.label} variant={chip.isError ? 'danger' : 'muted'} size="xs">
              {chip.label}
              {chip.count !== undefined && chip.count > 1 && (
                <span className="opacity-60">×{chip.count}</span>
              )}
            </Badge>
          ))
        )}
      </span>
      <RotatableChevron open={expanded} className="opacity-40 shrink-0" />
    </button>
  );
}
