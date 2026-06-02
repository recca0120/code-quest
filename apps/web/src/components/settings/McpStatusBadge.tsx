import type { McpServerInfo } from '@code-quest/schemas';
import { cn } from '@/utils/cn';

type McpStatus = McpServerInfo['status'];

const STATUS_BADGE_CLASS: Partial<Record<McpStatus, string>> = {
  connected: 'bg-success text-selected-text',
  failed: 'bg-danger text-selected-text',
  error: 'bg-danger text-selected-text',
  'needs-auth': 'bg-warning text-bg',
  connecting: 'bg-border text-muted',
  disabled: 'tint-10 text-muted',
  disconnected: 'tint-10 text-muted',
};

const STATUS_ICON: Partial<Record<McpStatus, string>> = {
  connected: '✓',
  failed: '✗',
  error: '✗',
  'needs-auth': '⚠',
  disabled: '○',
};

const STATUS_LABEL: Partial<Record<McpStatus, string>> = {
  connected: 'Connected',
  failed: 'Failed',
  error: 'Error',
  'needs-auth': 'Needs Auth',
  connecting: 'Connecting…',
  disabled: 'Disabled',
};

const DEFAULT_CLASS = 'bg-border text-muted';

interface McpStatusBadgeProps {
  status: McpStatus;
  rich?: boolean;
  className?: string;
}

export function McpStatusBadge({
  status,
  rich = false,
  className,
}: McpStatusBadgeProps): React.JSX.Element {
  const badgeClass = STATUS_BADGE_CLASS[status] ?? DEFAULT_CLASS;
  const icon = STATUS_ICON[status];
  const label = STATUS_LABEL[status] ?? status;

  return (
    <span className={cn('shrink-0 rounded px-2 py-1 text-xs font-medium', badgeClass, className)}>
      {!rich ? status : icon ? `${icon} ${label}` : label}
    </span>
  );
}
