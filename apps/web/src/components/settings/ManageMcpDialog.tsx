import type { Ack, McpServerInfo, ProviderClientConfig, RpcResult } from '@code-quest/schemas';
import { useState } from 'react';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { useChannelConfig } from '@/contexts/channel';
import { cn } from '@/utils/cn';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogClose, DialogContent } from '../ui/Dialog.tsx';
import { XIcon } from '../ui/Icons.tsx';
import { InlineCode } from '../ui/InlineCode.tsx';
import { SurfaceCard } from '../ui/SurfaceCard.tsx';
import { McpStatusBadge } from './McpStatusBadge.tsx';

const SCOPE_ORDER = ['project', 'local', 'user', 'claudeai', 'managed', 'enterprise'];

const DEFAULT_SCOPE_LABELS: Record<string, string> = {
  project: 'Project',
  local: 'Local',
  user: 'User',
  claudeai: 'claude.ai',
  managed: 'Managed',
  enterprise: 'Enterprise',
};

function scopeLabel(scope: string, mcpScopes?: ProviderClientConfig['mcpScopes']): string {
  const configLabel = mcpScopes?.find((s) => s.id === scope)?.label;
  return configLabel ?? DEFAULT_SCOPE_LABELS[scope] ?? scope;
}

function inferScope(name: string, mcpScopes?: ProviderClientConfig['mcpScopes']): string {
  if (mcpScopes) {
    const match = mcpScopes.find((s) => s.prefix && name.startsWith(s.prefix));
    if (match) return match.id;
  }
  return name.startsWith('claude.ai ') ? 'claudeai' : 'user';
}

function groupByScope(
  servers: McpServerInfo[],
  mcpScopes?: ProviderClientConfig['mcpScopes'],
): Array<[string, McpServerInfo[]]> {
  const map = new Map<string, McpServerInfo[]>();
  for (const s of servers) {
    const scope = s.scope ?? inferScope(s.name, mcpScopes);
    const group = map.get(scope);
    if (group) group.push(s);
    else map.set(scope, [s]);
  }
  for (const g of map.values()) g.sort((a, b) => a.name.localeCompare(b.name));
  const result: Array<[string, McpServerInfo[]]> = [];
  for (const scope of SCOPE_ORDER) {
    const group = map.get(scope);
    if (group) result.push([scope, group]);
  }
  for (const [scope, group] of map) {
    if (!SCOPE_ORDER.includes(scope)) result.push([scope, group]);
  }
  return result;
}

function McpReadOnlyList({ servers }: { servers: McpServerInfo[] }) {
  return (
    <>
      {servers.length === 0 ? (
        <p className="text-xs text-muted py-4 text-center">No running MCP servers.</p>
      ) : (
        <ul className="my-2">
          {servers.map((s) => (
            <SurfaceCard
              as="li"
              key={s.name}
              className={cn(
                'flex items-center justify-between gap-3 mb-2 last:mb-0',
                s.status === 'disabled' && 'opacity-60',
              )}
            >
              <span className="font-mono text-xs font-medium text-text truncate">{s.name}</span>
              <McpStatusBadge status={s.status} />
            </SurfaceCard>
          ))}
        </ul>
      )}
      <div className="text-xs text-muted mt-4">
        You can use the <InlineCode>claude mcp add</InlineCode> command-line tool to configure
        system-wide or private servers.
        <br />
        <a
          href="https://code.claude.com/docs/en/mcp"
          target="_blank"
          rel="noreferrer"
          className="text-muted hover:underline"
        >
          Learn more
        </a>
      </div>
    </>
  );
}

function McpGroupedList({
  groups,
  mcpScopes,
  onSelect,
}: {
  groups: Array<[string, McpServerInfo[]]>;
  mcpScopes?: ProviderClientConfig['mcpScopes'];
  onSelect: (name: string) => void;
}) {
  return (
    <>
      {groups.length === 0 ? (
        <p className="text-xs text-muted py-4 text-center">No MCP servers configured.</p>
      ) : (
        <div className="my-2">
          {groups.map(([scope, group]) => (
            <div key={scope}>
              <div className="text-xs font-semibold text-muted pb-1 pt-2 first:pt-0">
                {scopeLabel(scope, mcpScopes)} ({group.length})
              </div>
              {group.map((s) => (
                <SurfaceCard
                  as="button"
                  type="button"
                  key={s.name}
                  onClick={() => onSelect(s.name)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 mb-2 last:mb-0 cursor-pointer hover:bg-surface/60',
                    s.status === 'disabled' && 'opacity-60',
                  )}
                >
                  <span className="font-mono text-xs font-medium text-text truncate">{s.name}</span>
                  <McpStatusBadge status={s.status} rich />
                </SurfaceCard>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-border mt-4 pt-4">
        <a
          href="https://code.claude.com/docs/en/mcp"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted hover:underline"
        >
          Learn more about MCP
        </a>
      </div>
    </>
  );
}

type PendingAction = { server: string; action: string } | null;

type Feedback = { msg: string; ok: boolean };

function McpDetailView({
  detail,
  pending,
  feedback,
  onReconnect,
  onToggle,
  onAuthenticate,
  onClearAuth,
  act,
}: {
  detail: McpServerInfo;
  pending: PendingAction;
  feedback: Feedback | null;
  onReconnect?: (name: string) => Promise<void>;
  onToggle?: (name: string, enabled: boolean) => Promise<void>;
  onAuthenticate?: (name: string) => Promise<RpcResult<{ authUrl?: string }>>;
  onClearAuth?: (name: string) => Promise<Ack>;
  act: (action: string, fn: () => Promise<Feedback | void>) => void;
}) {
  return (
    <div className="space-y-3">
      <SurfaceCard className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium text-text">{detail.name}</span>
        <McpStatusBadge status={detail.status} rich />
      </SurfaceCard>

      {feedback && (
        <p className={cn('text-xs', feedback.ok ? 'text-success' : 'text-danger')}>
          {feedback.msg}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onReconnect &&
          (detail.status === 'connected' ||
            detail.status === 'failed' ||
            detail.status === 'error') && (
            <Button
              variant="secondary"
              size="xs"
              disabled={!!pending}
              onClick={() => act('reconnect', () => onReconnect(detail.name))}
            >
              {pending?.action === 'reconnect' ? 'Reconnecting…' : 'Reconnect'}
            </Button>
          )}

        {onToggle && detail.status !== 'disabled' ? (
          <Button
            variant="secondary"
            size="xs"
            disabled={!!pending}
            onClick={() => act('disable', () => onToggle(detail.name, false))}
          >
            {pending?.action === 'disable' ? 'Disabling…' : 'Disable'}
          </Button>
        ) : onToggle ? (
          <Button
            size="xs"
            disabled={!!pending}
            onClick={() => act('enable', () => onToggle(detail.name, true))}
          >
            {pending?.action === 'enable' ? 'Enabling…' : 'Enable'}
          </Button>
        ) : null}

        {onAuthenticate && (detail.status === 'needs-auth' || detail.status === 'failed') && (
          <Button
            size="xs"
            disabled={!!pending}
            onClick={() =>
              act('authenticate', async () => {
                const res = await onAuthenticate(detail.name);
                if (!res.ok) return { msg: res.error, ok: false };
                if (res.data.authUrl) return { msg: `Open: ${res.data.authUrl}`, ok: true };
              })
            }
          >
            {pending?.action === 'authenticate' ? 'Authenticating…' : 'Authenticate'}
          </Button>
        )}

        {onClearAuth && detail.status === 'connected' && (
          <Button
            variant="secondary"
            size="xs"
            className="text-danger"
            disabled={!!pending}
            onClick={() =>
              act('clearAuth', async () => {
                const res = await onClearAuth(detail.name);
                if (!res.ok) return { msg: res.error, ok: false };
                return { msg: 'Auth cleared', ok: true };
              })
            }
          >
            {pending?.action === 'clearAuth' ? 'Clearing…' : 'Clear Auth'}
          </Button>
        )}
      </div>
    </div>
  );
}

interface ManageMcpDialogProps {
  open: boolean;
  onClose: () => void;
  servers: McpServerInfo[];
  onReconnect?: (name: string) => Promise<void>;
  onToggle?: (name: string, enabled: boolean) => Promise<void>;
  onAuthenticate?: (name: string) => Promise<RpcResult<{ authUrl?: string }>>;
  onClearAuth?: (name: string) => Promise<Ack>;
  onRefresh?: () => void;
}

export function ManageMcpDialog({
  open,
  onClose,
  servers,
  onReconnect,
  onToggle,
  onAuthenticate,
  onClearAuth,
  onRefresh,
}: ManageMcpDialogProps): React.JSX.Element {
  const { providerConfig } = useChannelConfig();
  const mcpScopes = providerConfig?.mcpScopes;

  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const isManageable = !!(onReconnect || onToggle || onAuthenticate);
  const groups = groupByScope(servers, mcpScopes);
  const detail = selectedServer ? servers.find((s) => s.name === selectedServer) : null;

  const act = async (action: string, fn: () => Promise<Feedback | void>) => {
    setFeedback(null);
    setPending({ server: selectedServer ?? '', action });
    try {
      const result = await fn();
      if (result) setFeedback(result);
      onRefresh?.();
    } catch (e) {
      console.error(e);
      setFeedback({ msg: e instanceof Error ? e.message : 'Failed', ok: false });
    } finally {
      setPending(null);
    }
  };

  const handleClose = () => {
    setSelectedServer(null);
    setFeedback(null);
    onClose();
  };

  const handleSelect = (name: string) => {
    setFeedback(null);
    setSelectedServer(name);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent title="Manage MCP Servers" className="w-96" hideTitle={true}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-text">
            {detail ? (
              <InlineAction
                variant="muted"
                className="flex items-center gap-1"
                onClick={() => {
                  setSelectedServer(null);
                  setFeedback(null);
                }}
              >
                ← {detail.name}
              </InlineAction>
            ) : (
              'Manage MCP Servers'
            )}
          </span>
          <DialogClose
            aria-label="Close"
            className="p-1 text-muted hover:text-text hover:bg-hover-tint rounded"
          >
            <XIcon className="w-4 h-4" />
          </DialogClose>
        </div>

        {!isManageable && !detail && <McpReadOnlyList servers={servers} />}

        {isManageable && !detail && (
          <McpGroupedList groups={groups} mcpScopes={mcpScopes} onSelect={handleSelect} />
        )}

        {detail && isManageable && (
          <McpDetailView
            detail={detail}
            pending={pending}
            feedback={feedback}
            onReconnect={onReconnect}
            onToggle={onToggle}
            onAuthenticate={onAuthenticate}
            onClearAuth={onClearAuth}
            act={act}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
