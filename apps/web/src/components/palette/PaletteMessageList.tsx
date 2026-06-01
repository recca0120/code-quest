import type { Message } from '@/types/ui';
import { cn } from '@/utils/cn';
import { highlight, messagePreview, typeColor, typeLabel } from '@/utils/message-preview';
import { SectionHeader } from '../ui/SectionHeader.tsx';

const BG_OPACITY = '18'; // ~9%
const BORDER_OPACITY = '40'; // ~25%

function badgeStyle(color: string): React.CSSProperties {
  return {
    color,
    background: `${color}${BG_OPACITY}`,
    border: `1px solid ${color}${BORDER_OPACITY}`,
  };
}

interface PaletteMessageListProps {
  results: Message[];
  query: string;
  activeIdx: number;
  onActiveChange: (idx: number) => void;
  onJumpTo: (id: string) => void;
  onClose: () => void;
  showHeader?: boolean;
  listRef?: React.RefObject<HTMLDivElement | null>;
  sourceLabels?: Map<string, string>;
}

export function PaletteMessageList({
  results,
  query,
  activeIdx,
  onActiveChange,
  onJumpTo,
  onClose,
  showHeader = false,
  listRef,
  sourceLabels,
}: PaletteMessageListProps): React.ReactNode {
  if (results.length === 0) return null;

  return (
    <>
      {showHeader && <SectionHeader>Messages</SectionHeader>}
      <div ref={listRef}>
        {results.map((msg, idx) => {
          const isActive = idx === activeIdx;
          const color = typeColor(msg.type);
          const label = typeLabel(msg.type);
          const preview = messagePreview(msg).slice(0, 200);
          const previewParts = highlight(preview, query);
          const source = sourceLabels?.get(msg.id);
          const prevResult = results[idx - 1];
          const prevSource = idx > 0 && prevResult ? sourceLabels?.get(prevResult.id) : undefined;
          const showSourceHeader = source != null && source !== prevSource;
          return (
            <div key={msg.id}>
              {showSourceHeader && (
                <SectionHeader aria-label="source-header" variant="prominent">
                  {source}
                </SectionHeader>
              )}
              <button
                type="button"
                data-active={isActive || undefined}
                onClick={() => {
                  onJumpTo(msg.id);
                  onClose();
                }}
                onMouseEnter={() => onActiveChange(idx)}
                className={cn(
                  'flex items-start gap-3 w-full px-4 py-2.5 border-none cursor-pointer text-left transition-[background] duration-100',
                  isActive
                    ? 'bg-row-active-bg border-l-2 border-l-accent'
                    : 'bg-transparent border-l-2 border-l-transparent',
                )}
              >
                <span
                  className="text-2xs font-mono font-bold tracking-wider uppercase rounded-sm px-1.5 py-0.5 shrink-0 mt-px whitespace-nowrap min-w-26 text-center"
                  style={badgeStyle(color)}
                >
                  {label}
                </span>
                <span className="text-xs font-mono text-muted leading-normal overflow-hidden line-clamp-2">
                  {previewParts.map((part, i) => {
                    const key = `${i}-${part.match ? 'm' : 't'}`;
                    return part.match ? (
                      <mark key={key} className="bg-accent-mark-bg text-accent rounded-sm px-px">
                        {part.text}
                      </mark>
                    ) : (
                      <span key={key}>{part.text}</span>
                    );
                  })}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
