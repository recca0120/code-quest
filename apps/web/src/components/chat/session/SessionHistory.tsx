import type { Ack, SessionSummary } from '@code-quest/schemas';
import { useState } from 'react';
import { focusRing } from '@/components/ui/_tokens';
import { cn } from '@/utils/cn';
import { SessionRow } from './SessionRow.tsx';

interface SessionHistoryProps {
  sessions: SessionSummary[];
  loading?: boolean;
  onSelect: (id: string) => void;
  onRename?: (id: string, title: string) => Promise<Ack>;
  onDelete?: (id: string) => Promise<Ack>;
}

export function SessionHistory({
  sessions,
  loading,
  onSelect,
  onRename,
  onDelete,
}: SessionHistoryProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? sessions.filter((s) => (s.title ?? s.channelId).toLowerCase().includes(query))
    : sessions;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[focusIndex]) {
          onSelect(filtered[focusIndex].channelId);
        }
        break;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface">
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          // biome-ignore lint/a11y/noAutofocus: dropdown opens without user click; immediate keyboard nav requires focus
          autoFocus
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setFocusIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search sessions..."
          className={cn(
            'w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent',
            focusRing,
          )}
        />
      </div>
      <div
        role="listbox"
        aria-label="Sessions"
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      >
        {loading && <div className="px-3 py-8 text-center text-muted text-sm">Loading...</div>}
        {!loading && filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-muted text-sm">No sessions</div>
        )}
        {filtered.map((s, i) => (
          <SessionRow
            key={s.channelId}
            session={s}
            isFocused={i === focusIndex}
            isActive={s.isActive}
            onSelect={onSelect}
            onMouseEnter={() => setFocusIndex(i)}
            onRename={onRename}
            onDelete={onDelete}
            searchQuery={search || undefined}
          />
        ))}
      </div>
    </div>
  );
}
