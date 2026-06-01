import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { JsonViewer } from '@/components/chat/ui/JsonViewer';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';
import { PanelHeader } from '../ui/PanelHeader';
import { RawEventFilterBar } from './RawEventFilterBar.tsx';
import {
  addVisibleTypes,
  buildFilterEntries,
  discoverNewTypes,
  filterEvents,
  getEventType,
} from './raw-event-utils.ts';
import { SearchBar } from './SearchBar';

const SCROLL_THRESHOLD_PX = 50;
const MAX_EVENTS = 5000;

const RawEventRow = memo(function RawEventRow({ index, event }: { index: number; event: unknown }) {
  const evtType = getEventType(event);
  return (
    <details className="border-b border-border">
      <summary className="px-4 py-2 cursor-pointer text-xs text-muted hover:text-text">
        Event #{index + 1}
        {evtType ? ` — ${evtType}` : ''}
      </summary>
      <div className="px-4 py-2 text-xs overflow-x-auto">
        <JsonViewer data={event} />
      </div>
    </details>
  );
});

interface RawEventPanelProps {
  onFetch?: () => Promise<{ events: unknown[] }>;
  onSubscribe?: (cb: (evt: unknown) => void) => () => void;
  onClose: () => void;
}

export function RawEventPanel({
  onFetch,
  onSubscribe,
  onClose,
}: RawEventPanelProps): React.JSX.Element {
  const [events, setEvents] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const seenTypesRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledRef = useRef(false);
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;

  const trackNewType = useCallback((evt: unknown) => {
    const newTypes = discoverNewTypes([evt], seenTypesRef.current);
    if (newTypes.length > 0) {
      setVisibleTypes((prev) => addVisibleTypes(prev, newTypes));
    }
  }, []);

  useEffect(() => {
    if (!onSubscribe) return;
    const unsubscribe = onSubscribe((evt) => {
      trackNewType(evt);
      setEvents((prev) =>
        prev.length >= MAX_EVENTS
          ? [...prev.slice(prev.length - MAX_EVENTS + 1), evt]
          : [...prev, evt],
      );
    });
    return unsubscribe;
  }, [onSubscribe, trackNewType]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD_PX;
    if (!atBottom && !userScrolledRef.current) {
      userScrolledRef.current = true;
      setAutoScroll(false);
    } else if (atBottom) {
      userScrolledRef.current = false;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const handleRefresh = async () => {
    if (!onFetch) return;
    setLoading(true);
    try {
      const result = await onFetch();
      seenTypesRef.current = new Set();
      setVisibleTypes(new Set());
      const newTypes = discoverNewTypes(result.events, seenTypesRef.current);
      if (newTypes.length > 0) setVisibleTypes(addVisibleTypes(new Set(), newTypes));
      setEvents(result.events);
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = useMemo(() => buildFilterEntries(events), [events]);
  const filteredEvents = useMemo(
    () => filterEvents(events, visibleTypes, searchText),
    [events, visibleTypes, searchText],
  );

  const virtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const totalSize = virtualizer.getTotalSize();
  // biome-ignore lint/correctness/useExhaustiveDependencies: totalSize is the trigger; scrollToBottom stable
  useEffect(() => {
    if (autoScrollRef.current) scrollToBottom();
  }, [totalSize]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border">
      <PanelHeader
        title="Raw Events"
        actions={
          <div className="flex gap-2">
            {onSubscribe && (
              <IconButton
                title="Auto-scroll"
                onClick={() => {
                  setAutoScroll(true);
                  userScrolledRef.current = false;
                  scrollToBottom();
                }}
                className={cn('text-muted hover:text-text', autoScroll && 'text-accent')}
              >
                ⤓
              </IconButton>
            )}
            {onFetch && (
              <IconButton
                title="Refresh"
                onClick={handleRefresh}
                className="text-muted hover:text-text"
              >
                ↻
              </IconButton>
            )}
            {events.length > 0 && (
              <IconButton
                title="Clear"
                onClick={() => {
                  setEvents([]);
                  seenTypesRef.current = new Set();
                  setVisibleTypes(new Set());
                }}
                className="text-muted hover:text-text"
              >
                ⌀
              </IconButton>
            )}
            <IconButton title="Close" onClick={onClose} className="text-muted hover:text-text">
              ✕
            </IconButton>
          </div>
        }
      />
      <SearchBar
        searchQuery={searchText}
        setSearchQuery={setSearchText}
        placeholder="Search events..."
      />
      {filterEntries.length > 0 && (
        <RawEventFilterBar
          entries={filterEntries}
          selected={visibleTypes}
          onChange={setVisibleTypes}
        />
      )}
      <div className="flex-1 min-h-0 relative">
        {loading && <div className="px-4 py-8 text-center text-muted text-sm">Loading...</div>}
        {!loading && events.length === 0 && (
          <div className="px-4 py-8 text-center text-muted text-sm">
            {onSubscribe ? 'Waiting for events…' : 'No events. Click ↻ to fetch.'}
          </div>
        )}
        {!loading && filteredEvents.length > 0 && (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="absolute inset-0 overflow-y-auto overflow-x-hidden"
          >
            <div
              style={{
                height: totalSize,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((item) => (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <RawEventRow index={item.index} event={filteredEvents[item.index]} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
