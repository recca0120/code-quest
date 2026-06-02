import { useState } from 'react';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { RotatableChevron } from '@/components/ui/Icons';
import type { Message } from '@/types/ui';
import { pluralize } from '@/utils/pluralize';
import { CollapsibleTimeline } from './CollapsibleTimeline.tsx';

export function SubagentChildren({
  messages,
  childrenIndex,
  onStopTask,
  onDiffRespond,
  parentToolId,
  model,
}: {
  messages: Message[];
  childrenIndex?: Map<string, Message[]>;
  onStopTask?: (taskId: string) => void;
  onDiffRespond?: (toolId: string, accepted: boolean) => void;
  parentToolId?: string;
  model?: string;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="ml-7 mt-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-subtle hover:text-muted cursor-pointer select-none flex items-center gap-1 py-0.5"
        >
          <RotatableChevron open={expanded} />
          <span>{pluralize(messages.length, 'subagent message')}</span>
        </button>
        {model && <span className="text-xs text-dim font-mono">{model}</span>}
        {onStopTask && parentToolId && (
          <InlineAction
            variant="danger"
            title="Stop subagent"
            onClick={() => onStopTask(parentToolId)}
          >
            ■
          </InlineAction>
        )}
      </div>
      {expanded && (
        <div className="border-l-2 border-text-muted/15 pl-4 mt-1">
          <CollapsibleTimeline
            messages={messages}
            childrenIndex={childrenIndex}
            onStopTask={onStopTask}
            onDiffRespond={onDiffRespond}
          />
        </div>
      )}
    </div>
  );
}
