import { useSmoothedValue } from '@/hooks/useSmoothedValue.ts';
import { formatTokenCount } from '@/utils/format-number';
import { MarkdownContent } from '../renderers/MarkdownContent.tsx';
import { BlockCollapsible } from '../tool-use/BlockCollapsible';
import { ToolUseHeader } from '../tool-use/ToolUseHeader';

interface ThinkingBlockProps {
  content: string;
  budgetTokens?: number;
  /** Duration in milliseconds (null = still thinking) */
  durationMs?: number | null;
  /** Whether the thinking block is currently streaming */
  isStreaming?: boolean;
  /** Accumulated estimated tokens from streaming deltas */
  estimatedTokens?: number;
  blockId: string;
}

// Separate component so useSmoothedValue can be called unconditionally (Rules of Hooks)
function ThinkingTokenCount({ estimate }: { estimate: number }): React.ReactNode {
  const smoothed = useSmoothedValue(estimate);
  const text = formatTokenCount(smoothed);
  if (!text) return null;
  return <span className="text-subtle text-xs">· {text}</span>;
}

function thinkingLabel(
  isStreaming: boolean,
  durationMs?: number | null,
  budgetTokens?: number,
): string {
  if (isStreaming) return 'Thinking...';
  if (durationMs != null) return `Thought for ${Math.round(durationMs / 1000)}s`;
  if (budgetTokens != null) return `Thinking (${budgetTokens.toLocaleString()} tokens)`;
  return 'Thinking';
}

export function ThinkingBlock({
  content,
  budgetTokens,
  durationMs,
  isStreaming = false,
  estimatedTokens,
  blockId,
}: ThinkingBlockProps): React.ReactNode {
  if (!content.trim()) return null;

  const label = thinkingLabel(isStreaming, durationMs, budgetTokens);

  return (
    <BlockCollapsible
      blockId={blockId}
      header={
        <ToolUseHeader
          icon={null}
          name={label}
          badge={
            isStreaming && estimatedTokens ? (
              <ThinkingTokenCount estimate={estimatedTokens} />
            ) : undefined
          }
        />
      }
    >
      <div className="pl-3 border-l-2 border-border-subtle text-sm text-subtle">
        <MarkdownContent content={content} />
      </div>
    </BlockCollapsible>
  );
}
