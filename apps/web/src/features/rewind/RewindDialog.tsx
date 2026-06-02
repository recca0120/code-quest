import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-1 py-0.5 bg-surface-hover rounded text-xs">{children}</kbd>;
}

import { useChannelStore } from '@/stores/ChannelStoreContext';
import type { Message } from '@/types/ui';
import { cn } from '@/utils/cn';
import { formatRelativeDate } from '@/utils/format-relative-date';
import { RewindBody } from './RewindBody.tsx';
import { RewindConfirmDialog } from './RewindConfirmDialog.tsx';

interface RewindItem {
  message: Message;
  promptText: string;
}

function getRewindableMessages(messages: Message[]): RewindItem[] {
  const items: RewindItem[] = [];
  for (const msg of messages) {
    if (msg.type !== 'text' || msg.role !== 'user' || msg.parentToolUseId) continue;
    if (!msg.cliUuid) continue;
    const text = msg.content.trim();
    if (!text) continue;
    items.push({ message: msg, promptText: text });
  }
  return items.reverse();
}

interface RewindOptionProps {
  item: RewindItem;
  index: number;
  focusIndex: number;
  now: Date;
  onSelect: (item: RewindItem) => void;
  onFocus: (index: number) => void;
}

function RewindOption({ item, index, focusIndex, now, onSelect, onFocus }: RewindOptionProps) {
  return (
    <button
      type="button"
      key={item.message.id}
      role="option"
      aria-selected={index === focusIndex}
      onClick={() => onSelect(item)}
      onMouseEnter={() => onFocus(index)}
      className={cn(
        'flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm text-left',
        index === focusIndex ? 'bg-selected text-selected-text' : 'text-text hover:bg-hover-tint',
      )}
    >
      <span className="truncate mr-3">{item.promptText}</span>
      <span className="text-xs text-muted whitespace-nowrap">
        {formatRelativeDate(new Date(item.message.timestamp), now)}
      </span>
    </button>
  );
}

interface RewindDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (item: { messageId: string; promptText: string }) => void;
}

export function RewindDialog({ open, onClose, onConfirm }: RewindDialogProps): React.JSX.Element {
  const messages = useChannelStore((s) => s.messages);
  const items = useMemo(() => getRewindableMessages(messages), [messages]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [selected, setSelected] = useState<RewindItem | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFocusIndex(0);
    setSelected(null);
    setNow(new Date());
    const t = setTimeout(() => listRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const handleSelect = (item: RewindItem) => setSelected(item);

  const handleConfirm = () => {
    if (!selected?.message.cliUuid) return;
    onConfirm({ messageId: selected.message.cliUuid, promptText: selected.promptText });
  };

  const handleBack = () => setSelected(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[focusIndex];
      if (item) handleSelect(item);
    }
  };

  if (selected) {
    return (
      <RewindConfirmDialog
        open={open}
        title="Rewind code"
        onConfirm={handleConfirm}
        onCancel={handleBack}
      >
        <RewindBody />
      </RewindConfirmDialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Rewind to…" hideTitleDivider className="w-130 max-w-[90vw]">
        {items.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No messages to rewind to yet.</p>
        ) : (
          <>
            <p className="text-sm text-muted mb-3">
              Select a message to restore code and fork the conversation from that point.
            </p>
            <div
              ref={listRef}
              role="listbox"
              aria-label="Messages to rewind to"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className="flex flex-col gap-0.5 outline-none max-h-75 overflow-y-auto"
            >
              {items.map((item, i) => (
                <RewindOption
                  key={item.message.id}
                  item={item}
                  index={i}
                  focusIndex={focusIndex}
                  now={now}
                  onSelect={handleSelect}
                  onFocus={setFocusIndex}
                />
              ))}
            </div>
            <p className="text-xs text-muted mt-3">
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate · <Kbd>Enter</Kbd> to select · <Kbd>Esc</Kbd> to
              close
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
