import { useShallow } from 'zustand/react/shallow';
import { useChannelStore } from '@/stores/ChannelStoreContext';
import type { AssistantTurn, Block } from '@/types/ui';
import { MarkdownContent } from '../renderers/MarkdownContent.tsx';
import { ToolUseCollapsible } from '../tool-use/ToolUseCollapsible.tsx';
import { Expandable } from '../ui/Expandable';
import { CitationsPanel } from './CitationsPanel.tsx';
import { ThinkingBlock } from './ThinkingBlock.tsx';

function ToolUseBlockCollapsible({
  block,
  isLastTurn,
}: {
  block: Block;
  isLastTurn?: boolean;
}): React.JSX.Element {
  const toolId = block.toolId ?? '';
  const { task, result } = useChannelStore(
    useShallow((s) => ({
      task: s.tasks.get(toolId),
      result: s.results.get(toolId),
    })),
  );
  return (
    <ToolUseCollapsible
      toolName={block.content}
      input={block.input ?? {}}
      toolId={toolId}
      task={task}
      result={result}
      partialInput={block.partialInput}
      isLastTurn={isLastTurn}
    />
  );
}

export function AssistantTurnContent({
  message,
  isLastTurn,
}: {
  message: AssistantTurn;
  isLastTurn?: boolean;
}): React.JSX.Element | null {
  const blocks = message.blocks.map((block) => {
    if (block.type === 'thinking') {
      if (!block.content.trim()) return null;
      return (
        <ThinkingBlock
          key={block.id}
          content={block.content}
          budgetTokens={block.budget_tokens}
          durationMs={block.durationMs}
          isStreaming={block.isStreaming}
          estimatedTokens={block.estimatedTokens}
          blockId={block.id}
        />
      );
    }
    if (block.type === 'text') {
      return (
        <Expandable key={block.id} maxHeight={600} defaultOpen={true}>
          <div className="leading-relaxed">
            <MarkdownContent content={block.content} />
            {block.citations && <CitationsPanel citations={block.citations} />}
          </div>
        </Expandable>
      );
    }
    if (block.type === 'tool_use' && block.toolId) {
      return <ToolUseBlockCollapsible key={block.id} block={block} isLastTurn={isLastTurn} />;
    }
    return <p key={block.id}>{block.content}</p>;
  });
  if (blocks.every((b) => b == null)) return null;
  return <>{blocks}</>;
}
