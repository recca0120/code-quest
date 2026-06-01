import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { useState } from 'react';
import { Button } from '@/components/ui/Button.tsx';
import { SearchIcon } from '@/components/ui/Icons.tsx';
import { StatusDot } from '@/components/ui/StatusDot';
import { cn } from '@/utils/cn';
import { slugify } from '@/utils/slugify';

export interface FilterEntry {
  type: string;
  count: number;
}

function FilterCheckboxItem({
  entry,
  checked,
  barWidth,
  label,
  onToggle,
}: {
  entry: FilterEntry;
  checked: boolean;
  barWidth: number;
  label: string;
  onToggle: (type: string) => void;
}) {
  const id = `fp-${slugify(entry.type)}`;
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 px-3 py-1 cursor-pointer relative transition-colors hover:bg-hover-tint"
    >
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 pointer-events-none transition-all',
          checked ? 'bg-accent/[0.06]' : 'bg-hover-tint',
        )}
        style={{ width: `${barWidth}%` }}
      />
      <RadixCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={() => onToggle(entry.type)}
        className="sr-only"
      />
      <StatusDot
        color={checked ? 'accent' : 'muted'}
        size="sm"
        className="transition-colors z-sticky"
      />
      <span
        className={cn(
          'flex-1 text-xs font-mono transition-colors z-sticky',
          checked ? 'text-text' : 'text-dim',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-xs tabular-nums font-mono transition-colors z-sticky',
          checked ? 'text-accent/70' : 'text-faint',
        )}
      >
        {entry.count}
      </span>
    </label>
  );
}

interface FilterPopoverProps {
  entries: FilterEntry[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  labels?: Partial<Record<string, string>>;
}

export function FilterPopover({
  entries,
  selected,
  onChange,
  labels = {},
}: FilterPopoverProps): React.JSX.Element {
  const [search, setSearch] = useState('');

  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const q = search.toLowerCase();
  const visible = q ? sorted.filter((e) => e.type.toLowerCase().includes(q)) : sorted;

  const toggle = (type: string) => {
    const next = new Set(selected);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChange(next);
  };

  const selectAll = () => {
    const next = new Set(selected);
    for (const e of visible) next.add(e.type);
    onChange(next);
  };

  // Clear all removes every entry (not just visible ones) to avoid confusing partial clears
  const clearAll = () => {
    const next = new Set(selected);
    for (const e of sorted) next.delete(e.type);
    onChange(next);
  };

  const maxCount = sorted[0]?.count ?? 1;

  return (
    <div className="min-w-50 max-h-80 flex flex-col overflow-hidden rounded-lg border border-floating-border floating-popover-sm">
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1.5 border-b border-border/60">
        <SearchIcon className="w-3 h-3 text-dim" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter types..."
          className="flex-1 bg-transparent border-none outline-none text-xs text-text font-mono"
        />
        <div className="flex gap-1 shrink-0">
          <Button
            size="xs"
            variant="ghost"
            aria-label="Select all"
            onClick={selectAll}
            className="font-semibold tracking-wider uppercase text-accent bg-accent/10 hover:bg-accent/20 border border-accent/25 hover:border-accent/50 px-1.5 py-0.5"
          >
            All
          </Button>
          <Button
            size="xs"
            variant="ghost"
            aria-label="Clear all"
            onClick={clearAll}
            className="font-semibold tracking-wider uppercase text-muted hover:text-text bg-hover-tint hover:bg-surface-hover border border-floating-border-subtle px-1.5 py-0.5"
          >
            None
          </Button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 py-1">
        {visible.map((e) => (
          <FilterCheckboxItem
            key={e.type}
            entry={e}
            checked={selected.has(e.type)}
            barWidth={Math.round((e.count / maxCount) * 100)}
            label={labels[e.type] ?? e.type}
            onToggle={toggle}
          />
        ))}
        {visible.length === 0 && (
          <div className="p-3 text-center text-xs text-dim italic">No matches</div>
        )}
      </div>
    </div>
  );
}
