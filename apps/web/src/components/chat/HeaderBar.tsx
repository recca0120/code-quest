import { useChannelConfig, useChannelId } from '@/contexts/channel';
import { isThinkingActive, shortModelName } from '@/utils/model-utils';

const THINKING_LABELS: Record<string, string> = {
  default_on: 'Thinking',
  always_on: 'Thinking · Always',
  adaptive: 'Thinking · Adaptive',
};

function thinkingLevelLabel(level: string): string {
  return THINKING_LABELS[level] ?? `Thinking · ${level}`;
}

interface HeaderBarProps {
  title?: string | null;
  children?: React.ReactNode;
}

export function HeaderBar({ title, children }: HeaderBarProps): React.JSX.Element {
  const channelId = useChannelId();
  const { model, thinkingLevel, availableModels } = useChannelConfig();

  const sessionLabel = title ?? (channelId ? `${channelId.slice(0, 8)}…` : null);

  return (
    <header className="flex items-center gap-3 px-4 h-11 bg-surface border-b border-border text-xs shrink-0">
      {model && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-tint-10 text-muted">
          {shortModelName(model, availableModels)}
        </span>
      )}
      {isThinkingActive(thinkingLevel) && (
        <span
          className="text-xs px-1.5 py-0.5 rounded bg-tint-10 text-muted"
          title={`Thinking: ${thinkingLevel}`}
        >
          {thinkingLevelLabel(thinkingLevel)}
        </span>
      )}
      {sessionLabel && (
        <span className="text-subtle text-xs truncate flex-1 min-w-0">{sessionLabel}</span>
      )}
      {!sessionLabel && <div className="flex-1" />}
      {children}
    </header>
  );
}
