import type { ChatStats } from '@code-quest/schemas';
import { imageDataUri } from '@code-quest/utils';
import { MarkdownContent } from '@/components/chat/renderers/MarkdownContent';
import { Expandable } from '@/components/chat/ui/Expandable';
import { StatusLine } from '@/components/chat/ui/StatusLine';
import { Badge } from '@/components/ui/Badge';
import type { DocumentMeta, ImageMeta } from '@/types/ui';
import { cn } from '@/utils/cn';
import { CODE_BLOCK_CLASS } from '../renderers/ansi.tsx';
import { AlertBanner } from '../ui/AlertBanner';
import { CenterDivider } from '../ui/CenterDivider';
import { CollapsibleBlock } from '../ui/CollapsibleBlock';
import { renderIcon } from './message-type-icons.tsx';
import { ToolUseHeader } from './ToolUseHeader';

const SET_MODEL_PREFIX = /^Set model to /;

const CONTROL_RESPONSE_STYLES = [
  {
    prefix: 'Allowed Always',
    icon: '✓✓',
    colorClass: 'text-success bg-success-bg border-l-success',
  },
  { prefix: 'Approved', icon: '✓', colorClass: 'text-success bg-success-bg border-l-success' },
  { prefix: 'Denied & Stopped', icon: '⊘', colorClass: 'text-danger bg-danger-bg border-l-danger' },
  { prefix: 'Denied', icon: '✗', colorClass: 'text-warning bg-warning-bg border-l-warning' },
] as const;

const CONTROL_RESPONSE_DEFAULT = {
  icon: '↩',
  colorClass: 'text-muted tint-5 border-l-text-muted',
};

export function PendingActionContent({ content }: { content: string }): React.ReactNode {
  return (
    <AlertBanner className="bg-warning-bg border-l-warning px-4 py-2.5">
      <strong className="text-warning text-sm">⚠ Tool Approval: {content}</strong>
    </AlertBanner>
  );
}

export function ControlResponseContent({ content }: { content: string }): React.ReactNode {
  const { icon, colorClass } =
    CONTROL_RESPONSE_STYLES.find((s) => content.startsWith(s.prefix)) ?? CONTROL_RESPONSE_DEFAULT;
  return (
    <AlertBanner className={cn('px-4 py-2.5', colorClass)}>
      <span className="text-sm font-medium">
        {icon} {content}
      </span>
    </AlertBanner>
  );
}

export function ResultContent({ stats }: { stats?: ChatStats }): React.ReactNode {
  return (
    <CenterDivider data-type="result">
      {stats && (
        <div className="flex gap-3 font-mono text-xs text-subtle">
          {stats.costUsd != null && <span>${stats.costUsd.toFixed(4)}</span>}
          {stats.durationMs != null && <span>{(stats.durationMs / 1000).toFixed(1)}s</span>}
          {stats.inputTokens != null && <span>↑{stats.inputTokens}</span>}
          {stats.outputTokens != null && <span>↓{stats.outputTokens}</span>}
          {stats.numTurns != null && <span>{stats.numTurns} turns</span>}
        </div>
      )}
    </CenterDivider>
  );
}

export function ErrorContent({ content }: { content: string }): React.ReactNode {
  return (
    <AlertBanner className="bg-danger-bg border-l-danger px-4 py-3 text-danger" data-type="error">
      {content}
    </AlertBanner>
  );
}

export function CompactBoundaryContent(): React.ReactNode {
  return (
    <CenterDivider>
      <span>Context was compressed</span>
    </CenterDivider>
  );
}

export function InterruptContent(): React.ReactNode {
  return (
    <StatusLine icon={renderIcon('interrupt')} className="text-warning">
      <span className="italic">Interrupted by user</span>
    </StatusLine>
  );
}

export function MetaContent({ content }: { content: string }): React.ReactNode {
  if (!content) return null;
  return <div className="text-xs text-subtle italic">{content}</div>;
}

export function SlashCommandResultContent({ content }: { content: string }): React.ReactNode {
  if (!content.includes('\n')) {
    const short = content.replace(SET_MODEL_PREFIX, 'Switched to ');
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted bg-surface-hover rounded-full px-2.5 py-1">
        <span>✓</span>
        <span>{short}</span>
      </div>
    );
  }
  return (
    <div className="text-sm text-muted">
      <MarkdownContent content={content} />
    </div>
  );
}

export function RateLimitContent({
  content,
  rateLimitInfo,
}: {
  content: string;
  rateLimitInfo?: Record<string, unknown>;
}): React.ReactNode {
  return (
    <AlertBanner className="bg-warning-bg border-l-warning px-4 py-2.5">
      <span className="text-warning text-sm font-medium flex items-center gap-1">
        {renderIcon('rate_limit_event')}
        {content}
      </span>
      {rateLimitInfo && (
        <span className="ml-2 text-xs text-muted flex items-center gap-2">
          {rateLimitInfo.rateLimitType ? <span>{String(rateLimitInfo.rateLimitType)}</span> : null}
          {rateLimitInfo.resetsAt ? (
            <span>resets {new Date(Number(rateLimitInfo.resetsAt)).toLocaleTimeString()}</span>
          ) : null}
          {rateLimitInfo.isUsingOverage === true && (
            <span className="text-danger font-medium">Overage active</span>
          )}
          {rateLimitInfo.overageStatus && rateLimitInfo.isUsingOverage !== true ? (
            <span className="text-warning">Overage: {String(rateLimitInfo.overageStatus)}</span>
          ) : null}
        </span>
      )}
    </AlertBanner>
  );
}

export function TaskStartedContent({
  content,
  taskType,
}: {
  content: string;
  taskType?: string;
}): React.ReactNode {
  return (
    <StatusLine icon={renderIcon('task_started')} className="text-muted">
      <span>{content}</span>
      {taskType != null && (
        <Badge variant="accent" mono>
          {taskType}
        </Badge>
      )}
    </StatusLine>
  );
}

export function StreamlinedTextContent({
  content,
  defaultOpen,
}: {
  content: string;
  defaultOpen?: boolean;
}): React.ReactNode {
  return (
    <Expandable maxHeight={600} defaultOpen={defaultOpen}>
      <div className="relative">
        <span className="absolute -top-1 right-0 text-xs text-subtle font-mono">fast mode</span>
        <MarkdownContent content={content} />
      </div>
    </Expandable>
  );
}

export function StreamlinedToolSummaryContent({ content }: { content: string }): React.ReactNode {
  return (
    <CollapsibleBlock
      header={
        <ToolUseHeader icon={renderIcon('streamlined_tool_use_summary')} name="Tool Summary" />
      }
    >
      <pre className={CODE_BLOCK_CLASS}>{content}</pre>
    </CollapsibleBlock>
  );
}

export function ImageContent({ source }: { source?: ImageMeta['source'] }): React.ReactNode {
  if (!source?.data || source.type !== 'base64') return null;
  const dataUrl = imageDataUri(source.media_type ?? 'image/png', source.data);
  return (
    <div className="my-2">
      <img
        src={dataUrl}
        alt="Attachment"
        className="max-w-full max-h-100 rounded-lg border border-border"
      />
    </div>
  );
}

export function DocumentContent({
  content,
  title: titleProp,
  source,
}: {
  content: string;
  title?: string;
  source?: DocumentMeta['source'];
}): React.ReactNode {
  const title = titleProp ?? content ?? 'Document';
  const handleClick = () => {
    if (!source?.data) return;
    const dataUrl =
      source.type === 'base64'
        ? imageDataUri(source.media_type ?? 'application/octet-stream', source.data)
        : imageDataUri(source.media_type ?? 'text/plain', btoa(source.data));
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = title;
    a.click();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 bg-code-block border border-border rounded-lg px-3 py-2 text-xs text-text hover:bg-surface-hover transition-colors cursor-pointer"
    >
      <span>📄</span>
      <span className="max-w-50 truncate">{title}</span>
    </button>
  );
}

export function RedactedThinkingContent(): React.ReactNode {
  return <div className="text-xs text-muted italic">Thinking (redacted)</div>;
}

export function ContentBlockStart({ blockType }: { blockType?: string }): React.ReactNode {
  return (
    <div role="status" aria-label="block-placeholder" className="flex items-center gap-2 py-2">
      <div className="h-4 w-32 tint-10 rounded animate-pulse" />
      <div className="h-4 w-20 tint-5 rounded animate-pulse" />
      {blockType != null && <span className="text-xs text-subtle font-mono">{blockType}...</span>}
    </div>
  );
}
