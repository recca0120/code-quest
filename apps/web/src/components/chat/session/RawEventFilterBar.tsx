import { cn } from '@/utils/cn';
import type { FilterEntry } from './FilterPopover';

interface RawEventFilterBarProps {
  entries: FilterEntry[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function RawEventFilterBar({
  entries,
  selected,
  onChange,
}: RawEventFilterBarProps): React.ReactNode {
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const maxCount = sorted[0]?.count ?? 1;

  const toggle = (type: string) => {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange(next);
  };

  if (sorted.length === 0) return null;

  return (
    <div className="border-b border-floating-border-subtle py-1.5 pl-3 flex flex-col gap-1 flex-shrink-0">
      <div className="flex items-center justify-between pr-3">
        <span className="text-2xs font-mono tracking-widest uppercase text-border">channels</span>
        <div className="flex gap-2">
          {(
            [
              {
                label: 'all',
                onClick: () => onChange(new Set(sorted.map((e) => e.type))),
                hoverCls: 'hover:text-accent',
              },
              { label: 'none', onClick: () => onChange(new Set()), hoverCls: 'hover:text-text' },
            ] as const
          ).map(({ label, onClick, hoverCls }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={cn(
                'text-2xs font-mono text-faint bg-transparent border-0 cursor-pointer p-0 tracking-wider transition-colors duration-100',
                hoverCls,
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pr-3 pb-0.5 [scrollbar-width:none]">
        {sorted.map((entry) => {
          const active = selected.has(entry.type);
          const barRatio = entry.count / maxCount;

          return (
            <button
              key={entry.type}
              type="button"
              aria-label={entry.type}
              aria-pressed={active}
              onClick={() => toggle(entry.type)}
              title={`${entry.type} (${entry.count})`}
              className={cn(
                'relative flex items-center gap-1 px-1.5 py-0.5 rounded-sm flex-shrink-0 overflow-hidden cursor-pointer transition-[border-color,background] duration-150',
                active
                  ? 'border border-accent/50 bg-accent/10'
                  : 'border border-border/20 bg-transparent',
              )}
            >
              {/* bar fill behind text */}
              <div
                className={cn(
                  'absolute left-0 bottom-0 top-0 transition-[width] duration-300 pointer-events-none',
                  active ? 'bg-accent/10' : 'bg-transparent',
                )}
                style={{ width: `${Math.max(barRatio * 100, 8)}%` }}
              />
              <span
                className={cn(
                  'text-2xs font-mono transition-colors duration-150 relative whitespace-nowrap max-w-18 overflow-hidden text-ellipsis',
                  active ? 'text-accent' : 'text-dim',
                )}
              >
                {entry.type}
              </span>
              <span
                className={cn(
                  'text-2xs font-mono relative transition-colors duration-150',
                  active ? 'text-accent/60' : 'text-faint',
                )}
              >
                {entry.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
