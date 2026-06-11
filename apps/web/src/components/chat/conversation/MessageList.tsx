import { useVirtualizer, type VirtualItem, type Virtualizer } from '@tanstack/react-virtual';
import {
  forwardRef,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useCommandPaletteActions, useCommandPaletteState } from '@/contexts/CommandPaletteContext';
import {
  useChannelControl,
  useChannelId,
  useChannelMessages,
  useMessageVisibility,
} from '@/contexts/channel';
import { findStreamingTurn } from '@/contexts/channel/handlers/streaming';
import { selectIsActive, useChannelStore } from '@/stores/ChannelStoreContext';
import type { ForkFn, Message, RewindFn } from '@/types/ui';
import { NO_FORM } from '@/utils/hotkey-options';
import { isMessageVisible } from '@/utils/isMessageVisible';
import {
  buildChildrenIndex,
  getGroupKey,
  type RenderGroup,
  renderableGroups,
} from '@/utils/renderable-groups';
import { SpinnerVerb } from '../SpinnerVerb.tsx';
import { CollapsibleTimeline } from './CollapsibleTimeline.tsx';
import { NodeContent } from './NodeContent.tsx';

const SCROLL_THRESHOLD_PX = 50;
const SMOOTH_SCROLL_RESET_MS = 500;
const ESTIMATED_ITEM_HEIGHT_PX = 80;

interface MessageListHandle {
  scrollToMessage: (id: string) => void;
}

function scrollToEnd(
  scrollRef: RefObject<HTMLDivElement | null>,
  programmaticScrollRef: RefObject<boolean>,
  behavior: 'smooth' | 'instant' = 'smooth',
) {
  programmaticScrollRef.current = true;
  scrollRef.current?.scrollIntoView({ behavior });
  if (behavior === 'instant') {
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  } else {
    setTimeout(() => {
      programmaticScrollRef.current = false;
    }, SMOOTH_SCROLL_RESET_MS);
  }
}

function spotlightElement(el: Element) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const bubble = (el.querySelector('[data-type]') ?? el) as HTMLElement;
  delete bubble.dataset.highlighted;
  void bubble.offsetHeight;
  bubble.dataset.highlighted = 'true';
  bubble.addEventListener('animationend', () => delete bubble.dataset.highlighted, { once: true });
}

function expandCollapsedIfNeeded(container: Element, id: string): boolean {
  const collapsed = container.querySelector(`[data-collapsed-ids*="${id}"]`);
  if (!collapsed) return false;
  const expandBtn = collapsed.querySelector('button') as HTMLButtonElement | null;
  expandBtn?.click();
  return true;
}

function collectGroupIds(
  group: RenderGroup,
  topIndex: number,
  map: Map<string, number>,
  childrenIndex: Map<string, Message[]>,
) {
  if (group.kind === 'timeline') {
    for (const msg of group.messages) {
      map.set(msg.id, topIndex);
      collectChildIds(msg, topIndex, map, childrenIndex);
    }
  } else {
    map.set(group.message.id, topIndex);
    collectChildIds(group.message, topIndex, map, childrenIndex);
  }
}

function collectChildIds(
  msg: Message,
  topIndex: number,
  map: Map<string, number>,
  childrenIndex: Map<string, Message[]>,
) {
  const toolId = msg.type === 'tool_use' ? msg.toolId : undefined;
  if (!toolId) return;
  const children = childrenIndex.get(toolId);
  if (!children) return;
  for (const child of children) {
    map.set(child.id, topIndex);
    collectChildIds(child, topIndex, map, childrenIndex);
  }
}

function VirtualGroupItem({
  group,
  item,
  virtualizer,
  lastTurnId,
  childrenIndex,
  onRewind,
  onFork,
  onStopTask,
  onDiffRespond,
}: {
  group: RenderGroup;
  item: VirtualItem;
  virtualizer: Pick<Virtualizer<HTMLDivElement, HTMLDivElement>, 'measureElement'>;
  lastTurnId?: string;
  childrenIndex?: Map<string, Message[]>;
  onRewind?: RewindFn;
  onFork?: ForkFn;
  onStopTask?: (taskId: string) => void;
  onDiffRespond?: (toolId: string, accepted: boolean) => void;
}): React.JSX.Element {
  return (
    <div
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
      {group.kind === 'timeline' ? (
        <CollapsibleTimeline
          messages={group.messages}
          lastTurnId={lastTurnId}
          childrenIndex={childrenIndex}
          onRewind={onRewind}
          onFork={onFork}
          onStopTask={onStopTask}
          onDiffRespond={onDiffRespond}
        />
      ) : (
        <div data-message-id={group.message.id} className="animate-fade-in py-2">
          <NodeContent
            message={group.message}
            childrenIndex={childrenIndex}
            showAvatar={group.message.role !== group.prevRole}
            isLastTurn={group.message.type === 'assistant_turn' && group.message.id === lastTurnId}
            onRewind={onRewind}
            onFork={onFork}
            onStopTask={onStopTask}
            onDiffRespond={onDiffRespond}
          />
        </div>
      )}
    </div>
  );
}

export const MessageList: React.ForwardRefExoticComponent<
  { searchQuery?: string } & React.RefAttributes<MessageListHandle>
> = forwardRef<MessageListHandle, { searchQuery?: string }>(function MessageList(
  { searchQuery = '' },
  ref,
) {
  const channelId = useChannelId();
  const messages = useChannelStore((s) => s.messages);
  const isProcessing = useChannelStore(selectIsActive);
  const statusText = useChannelStore((s) => s.statusText);
  const taskProgressText = useChannelStore((s) => {
    for (const task of s.tasks.values()) {
      if (task.status === 'running' && task.progressText) return task.progressText;
    }
    return undefined;
  });
  const { rewindToMessage: onRewind, forkSession: onFork } = useChannelMessages();
  const { stopTask: onStopTask, diffRespond: onDiffRespond } = useChannelControl();
  const { enabledTypes, registerUnknownType, unknownTypes } = useMessageVisibility();
  const { registerJumpTo, unregisterJumpTo, openPalette } = useCommandPaletteActions();
  const { open: paletteOpen } = useCommandPaletteState();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const registeredCountRef = useRef(0);
  const selfRef = useRef<MessageListHandle | null>(null);

  useEffect(() => {
    if (!channelId) return;
    const scrollTo = (messageId: string) => selfRef.current?.scrollToMessage(messageId);
    registerJumpTo(channelId, scrollTo);
    return () => unregisterJumpTo(channelId);
  }, [channelId, registerJumpTo, unregisterJumpTo]);

  useHotkeys('mod+f', () => openPalette({ tab: 'messages' }), NO_FORM, [openPalette]);

  const handleScroll = (e?: React.UIEvent<HTMLElement>) => {
    if (programmaticScrollRef.current) return;
    const el = (e?.currentTarget ?? scrollContainerRef.current) as HTMLElement | null;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD_PX;
    isAtBottomRef.current = atBottom;
    if (showScrollButton === atBottom) setShowScrollButton(!atBottom);
  };

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastContentLen = lastMsg?.content.length ?? 0;
  const lastRole = lastMsg?.role ?? null;
  const prevScrollRef = useRef({ count: messages.length, contentLen: lastContentLen });
  useEffect(() => {
    const countChanged = messages.length !== prevScrollRef.current.count;
    const contentGrew = lastContentLen !== prevScrollRef.current.contentLen;
    prevScrollRef.current = { count: messages.length, contentLen: lastContentLen };
    if (!countChanged && !contentGrew) return;
    // A new user message means the user just submitted — always pull the
    // view back to the bottom, even if they had scrolled up while reading.
    if (countChanged && lastRole === 'user') {
      isAtBottomRef.current = true;
      scrollToEnd(scrollRef, programmaticScrollRef, 'smooth');
      return;
    }
    if (isAtBottomRef.current) {
      // Use instant during history load to avoid smooth-scroll lag between batches.
      const behavior = !countChanged ? 'instant' : 'smooth';
      scrollToEnd(scrollRef, programmaticScrollRef, behavior);
    }
  }, [messages.length, lastContentLen, lastRole]);

  const scrollToBottom = () => {
    isAtBottomRef.current = true;
    scrollToEnd(scrollRef, programmaticScrollRef, 'instant');
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler stabilizes registerUnknownType
  useEffect(() => {
    const newMessages = messages.slice(registeredCountRef.current);
    for (const m of newMessages) registerUnknownType(m.type);
    registeredCountRef.current = messages.length;
  }, [messages]);

  const streamingTurn = useMemo(() => findStreamingTurn(messages), [messages]);

  const lastTurnId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.type === 'assistant_turn') return messages[i]?.id;
    }
    return undefined;
  }, [messages]);

  const q = searchQuery.toLowerCase();
  const visibleMessages = useMemo(() => {
    let filtered = messages.filter(
      (m) => isMessageVisible(m, enabledTypes) || unknownTypes.has(m.type),
    );
    if (q) {
      filtered = filtered.filter((m) => m.content.toLowerCase().includes(q));
    }
    return filtered;
  }, [messages, enabledTypes, unknownTypes, q]);

  const childrenIndex = useMemo(() => buildChildrenIndex(messages), [messages]);

  const displayGroups = useMemo(() => [...renderableGroups(visibleMessages)], [visibleMessages]);

  const idToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < displayGroups.length; i++) {
      const g = displayGroups[i];
      if (g) collectGroupIds(g, i, map, childrenIndex);
    }
    return map;
  }, [displayGroups, childrenIndex]);

  const virtualizer = useVirtualizer({
    count: displayGroups.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT_PX,
    overscan: 5,
    getItemKey: (index) => {
      const group = displayGroups[index];
      if (!group) return index;
      return getGroupKey(group, index);
    },
  });

  // Virtualizer's total size changes as items get measured, but that doesn't
  // fire scroll events. Re-sync stick-to-bottom and scroll-button visibility
  // whenever the measured total grows.
  const totalSize = virtualizer.getTotalSize();
  // biome-ignore lint/correctness/useExhaustiveDependencies: totalSize is the trigger; effect reads live scroll metrics via ref
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (paletteOpen) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD_PX;
    setShowScrollButton(!atBottom);
  }, [totalSize]);

  const scrollToMessage = (id: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (expandCollapsedIfNeeded(container, id)) {
      requestAnimationFrame(() => scrollToMessage(id));
      return;
    }

    const el = container.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      spotlightElement(el);
      return;
    }

    const index = idToIndex.get(id);
    if (index === undefined) return;
    virtualizer.scrollToIndex(index, { align: 'center' });
    requestAnimationFrame(() => {
      const later = container.querySelector(`[data-message-id="${id}"]`);
      if (later) spotlightElement(later);
    });
  };

  useEffect(() => {
    selfRef.current = { scrollToMessage };
  });
  useImperativeHandle(ref, () => ({ scrollToMessage }));

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <section className="relative flex-1 overflow-hidden" aria-label="message-list">
      <section
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
        aria-label="message-list-scroll"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center select-none gap-3 relative -top-7">
            <span className="text-4xl text-assistant">✦</span>
            <span className="text-lg font-medium text-bright">Code Quest</span>
            <span className="text-sm text-muted">How can I help you today?</span>
          </div>
        ) : (
          <section aria-label="message-content-wrapper" className="px-4 pt-5 pb-32">
            <div
              style={{
                height: totalSize,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((item) => {
                const group = displayGroups[item.index];
                if (!group) return null;
                return (
                  <VirtualGroupItem
                    key={getGroupKey(group, item.index)}
                    group={group}
                    item={item}
                    virtualizer={virtualizer}
                    lastTurnId={lastTurnId}
                    childrenIndex={childrenIndex}
                    onRewind={onRewind}
                    onFork={onFork}
                    onStopTask={onStopTask}
                    onDiffRespond={onDiffRespond}
                  />
                );
              })}
            </div>
            {isProcessing && (
              <SpinnerVerb
                statusText={statusText ?? taskProgressText}
                startTime={streamingTurn?.timestamp}
                tokens={streamingTurn?.usage?.outputTokens}
              />
            )}
            <section ref={scrollRef} aria-label="message-list-bottom" />
          </section>
        )}
      </section>
      {showScrollButton && (
        <button
          type="button"
          aria-label="Scroll to bottom"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-float w-8 h-8 rounded-full bg-surface-hover text-muted hover:text-text flex items-center justify-center shadow-floating cursor-pointer transition-colors"
        >
          ↓
        </button>
      )}
    </section>
  );
});
MessageList.displayName = 'MessageList';
