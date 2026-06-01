import type { Ack, McpServerInfo, McpTool, RpcResult } from '@code-quest/schemas';
import { useState } from 'react';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { TextField } from '@/components/chat/ui/TextField';
import { cn } from '@/utils/cn';
import { Button } from '../ui/Button.tsx';
import { McpStatusBadge } from './McpStatusBadge.tsx';

interface McpServerRowProps {
  server: McpServerInfo;
  onToggle: (serverName: string, enabled: boolean) => void | Promise<void>;
  onReconnect: (serverName: string) => void | Promise<void>;
  onListTools?: (serverName: string) => Promise<McpTool[]>;
  onAuthenticate?: (serverName: string) => Promise<RpcResult<{ authUrl?: string }>>;
  onOAuthCallback?: (serverName: string, callbackUrl: string) => Promise<Ack>;
  onClearAuth?: (serverName: string) => Promise<Ack>;
  showFeedback: (message: string, type: 'success' | 'error') => void;
}

export function McpServerRow({
  server: s,
  onToggle,
  onReconnect,
  onListTools,
  onAuthenticate,
  onOAuthCallback,
  onClearAuth,
  showFeedback,
}: McpServerRowProps): React.JSX.Element {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [authUrl, setAuthUrl] = useState('');

  const runAction = async <T,>(label: string, fn: () => T | Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      console.error(`McpServerRow ${label} failed for ${s.name}:`, err);
      showFeedback(`Failed to ${label} ${s.name}`, 'error');
      return null;
    }
  };

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-3 px-4 py-3">
        <McpStatusBadge status={s.status} />
        <span className="flex-1 text-xs font-mono text-text truncate">{s.name}</span>
        {onListTools && (
          <InlineAction
            title={`Tools ${s.name}`}
            onClick={async () => {
              if (toolsExpanded) {
                setToolsExpanded(false);
                return;
              }
              const result = await runAction('list tools for', () => onListTools(s.name));
              if (result) {
                setTools(result);
                setToolsExpanded(true);
              }
            }}
          >
            Tools
          </InlineAction>
        )}
        <button
          type="button"
          title={`Toggle ${s.name}`}
          onClick={async () => {
            const ok = await runAction('toggle', () => onToggle(s.name, !s.enabled));
            if (ok !== null) showFeedback(`${s.name} toggled`, 'success');
          }}
          className={cn(
            'text-xs px-2 py-0.5 rounded border transition-colors',
            s.enabled
              ? 'border-success/30 text-success hover:bg-success/10'
              : 'border-border text-muted hover:bg-hover-tint',
          )}
        >
          {s.enabled ? 'On' : 'Off'}
        </button>
        <InlineAction
          title={`Reconnect ${s.name}`}
          onClick={async () => {
            const ok = await runAction('reconnect', () => onReconnect(s.name));
            if (ok !== null) showFeedback(`${s.name} reconnected`, 'success');
          }}
        >
          ↻
        </InlineAction>
        {onClearAuth && (
          <InlineAction
            title={`Clear Auth ${s.name}`}
            onClick={async () => {
              const result = await runAction('clear auth for', () => onClearAuth(s.name));
              if (result === null) return;
              if (result.ok) showFeedback(`${s.name} auth cleared`, 'success');
              else showFeedback(result.error || 'Clear auth failed', 'error');
            }}
          >
            Clear Auth
          </InlineAction>
        )}
        {onAuthenticate && (
          <InlineAction
            title={`Auth ${s.name}`}
            onClick={async () => {
              const result = await runAction('authenticate', () => onAuthenticate(s.name));
              if (result === null) return;
              if (result.ok && result.data.authUrl) {
                setAuthUrl(result.data.authUrl);
                showFeedback(`Auth URL received for ${s.name}`, 'success');
              } else if (result.ok) {
                showFeedback(`${s.name} authenticated`, 'success');
              } else {
                showFeedback(result.error || 'Auth failed', 'error');
              }
            }}
          >
            Auth
          </InlineAction>
        )}
      </div>
      {authUrl && (
        <McpAuthSection
          authUrl={authUrl}
          serverName={s.name}
          onOAuthCallback={onOAuthCallback}
          onComplete={(result) => {
            if (result.ok) {
              showFeedback(`OAuth callback sent for ${s.name}`, 'success');
              setAuthUrl('');
            } else {
              showFeedback(result.error || 'Callback failed', 'error');
            }
          }}
          runAction={runAction}
        />
      )}
      {toolsExpanded && <McpToolsList tools={tools} serverName={s.name} />}
    </div>
  );
}

function McpAuthSection({
  authUrl,
  serverName,
  onOAuthCallback,
  onComplete,
  runAction,
}: {
  authUrl: string;
  serverName: string;
  onOAuthCallback?: (serverName: string, callbackUrl: string) => Promise<Ack>;
  onComplete: (result: Ack) => void;
  runAction: <T>(label: string, fn: () => T | Promise<T>) => Promise<T | null>;
}): React.JSX.Element {
  const [callbackInput, setCallbackInput] = useState('');
  return (
    <div className="px-4 pb-2">
      <a
        href={authUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent hover:underline"
      >
        Complete authentication →
      </a>
      {onOAuthCallback && (
        <div className="flex gap-1 mt-2">
          <TextField
            type="text"
            placeholder="Callback URL"
            value={callbackInput}
            onChange={setCallbackInput}
            mono
            size="sm"
            className="flex-1"
          />
          <Button
            variant="primary"
            size="xs"
            className="px-2 py-1"
            onClick={async () => {
              const url = callbackInput.trim();
              if (!url) return;
              const result = await runAction('submit callback for', () =>
                onOAuthCallback(serverName, url),
              );
              if (result === null) return;
              onComplete(result);
              if (result.ok) setCallbackInput('');
            }}
          >
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

function McpToolsList({
  tools,
  serverName,
}: {
  tools: McpTool[];
  serverName: string;
}): React.JSX.Element {
  return (
    <section aria-label={`tools-${serverName}`} className="px-6 pb-3">
      {tools.length === 0 ? (
        <p className="text-xs text-muted">No tools</p>
      ) : (
        <ul className="space-y-1">
          {tools.map((tool) => (
            <li key={tool.name} className="text-xs">
              <span className="font-mono text-text">{tool.name}</span>
              {tool.description && <span className="ml-1 text-muted">— {tool.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
