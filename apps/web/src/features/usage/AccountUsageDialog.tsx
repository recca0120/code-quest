import {
  type ChatStats,
  contextUsageDataSchema,
  modelUsageEntrySchema,
  type ProviderClientConfig,
  type UsageQuota,
} from '@code-quest/schemas';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/utils/cn';
import { formatTokens } from '@/utils/format-number';
import { DEFAULT_USAGE_TIERS, getTier } from '@/utils/model-utils';
import { openUrl } from '@/utils/open-url';
import {
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
} from '@/utils/time-constants';

function formatResetTime(resetsAt: string): string | null {
  try {
    const ms = new Date(resetsAt).getTime() - Date.now();
    if (!(ms > 0)) return 'soon';
    const min = Math.floor(ms / MS_PER_MINUTE);
    const hrs = Math.floor(ms / MS_PER_HOUR);
    const days = Math.floor(ms / MS_PER_DAY);
    if (min < MINUTES_PER_HOUR) return `in ${min}m`;
    if (hrs < HOURS_PER_DAY) return `in ${hrs}h`;
    return `in ${days}d`;
  } catch {
    return null;
  }
}

interface AccountUsageDialogProps {
  open: boolean;
  onClose: () => void;
  model?: string;
  authMethod?: string;
  email?: string;
  organization?: string;
  subscriptionType?: string;
  usage?: UsageQuota;
  contextUsage?: Record<string, unknown>;
  stats?: ChatStats;
  providerConfig?: ProviderClientConfig;
}

const DEFAULT_AUTH_METHODS: Record<string, string> = {
  claudeai: 'Claude AI',
  console: 'Anthropic Console',
  'api-key': 'API Key',
  '3p': 'Third Party',
  'not-specified': 'Not Specified',
};

function formatAuthMethod(
  method: string,
  authMethods?: ProviderClientConfig['authMethods'],
): string {
  const configLabel = authMethods?.find((m) => m.id === method)?.label;
  if (configLabel) return configLabel;
  return DEFAULT_AUTH_METHODS[method] ?? 'Not authenticated';
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs py-1">
      <span className="text-muted/60">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}

function UsageBarRow({
  label,
  utilization,
  resetsAt,
}: {
  label: string;
  utilization: number;
  resetsAt?: string;
}) {
  const pct = Math.min(100, Math.floor(utilization * 100));
  const isHigh = pct >= HIGH_USAGE_THRESHOLD_PCT;
  const resetText = resetsAt ? formatResetTime(resetsAt) : null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text">{label}</span>
        <span className="text-text tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 bg-hover-tint rounded-sm overflow-hidden">
        <div
          className={cn('h-full rounded-sm transition-all', isHigh ? 'bg-danger' : 'bg-accent')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {resetText && <div className="text-xs text-muted/60">Resets {resetText}</div>}
    </div>
  );
}

const HIGH_USAGE_THRESHOLD_PCT = 80;
const FREE_SPACE_CATEGORY = 'Free space';

export function AccountUsageDialog({
  open,
  onClose,
  model,
  authMethod,
  email,
  organization,
  subscriptionType,
  usage,
  contextUsage: rawContextUsage,
  stats,
  providerConfig,
}: AccountUsageDialogProps): React.JSX.Element {
  const contextUsage = contextUsageDataSchema.safeParse(rawContextUsage).data;
  const manageUrl =
    subscriptionType === 'team' || subscriptionType === 'enterprise'
      ? 'https://claude.ai/admin-settings/usage'
      : 'https://claude.ai/settings/usage';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-popover bg-overlay" />
        <Dialog.Content
          aria-label="Account & Usage"
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-popover bg-bg border border-border rounded-lg w-100 dialog-viewport overflow-y-auto m-4 p-4 select-text outline-none"
        >
          <div className="flex items-center justify-between mb-2">
            <Dialog.Title className="text-base font-semibold text-text">
              Account & Usage
            </Dialog.Title>
            <Dialog.Close
              aria-label="close"
              className="text-muted hover:text-text transition-colors text-lg leading-none"
            >
              ✕
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* ACCOUNT section */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted/60 uppercase tracking-wider mb-2">
                Account
              </h4>
              {model && <AccountRow label="Model" value={model} />}
              {authMethod && (
                <AccountRow
                  label="Auth method"
                  value={formatAuthMethod(authMethod, providerConfig?.authMethods)}
                />
              )}
              {email && <AccountRow label="Email" value={email} />}
              {organization && <AccountRow label="Organization" value={organization} />}
              {subscriptionType && <AccountRow label="Plan" value={subscriptionType} />}
            </div>

            {/* SESSION section */}
            {stats && (stats.costUsd != null || stats.numTurns != null) && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted/60 uppercase tracking-wider mb-2">
                  Session
                </h4>
                {stats.costUsd != null && (
                  <AccountRow label="Cost" value={`$${stats.costUsd.toFixed(2)}`} />
                )}
                {stats.numTurns != null && (
                  <AccountRow label="Turns" value={String(stats.numTurns)} />
                )}
                {stats.modelUsage &&
                  Object.entries(stats.modelUsage).map(([m, u]) => (
                    <AccountRow
                      key={m}
                      label={m.split('-').slice(0, 2).join(' ')}
                      value={`$${(modelUsageEntrySchema.safeParse(u).data?.costUSD ?? 0).toFixed(2)}`}
                    />
                  ))}
              </div>
            )}

            {/* CONTEXT section */}
            {contextUsage?.categories && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted/60 uppercase tracking-wider">
                  Context ({contextUsage.percentage ?? 0}% used)
                </h4>
                <div className="text-xs text-muted mb-1">
                  {formatTokens(contextUsage.totalTokens ?? 0)} /{' '}
                  {formatTokens(contextUsage.maxTokens ?? 0)} tokens
                </div>
                {contextUsage.categories
                  .filter((c) => c.name !== FREE_SPACE_CATEGORY)
                  .map((cat) => (
                    <div key={cat.name} className="flex justify-between text-xs">
                      <span className="text-muted/60">{cat.name}</span>
                      <span className="text-text tabular-nums">{formatTokens(cat.tokens)}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* QUOTA section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted/60 uppercase tracking-wider">
                Quota
              </h4>
              {authMethod && authMethod !== 'claudeai' && !usage ? (
                <p className="text-xs text-muted italic">
                  Usage tracking is only available for Claude AI subscribers.
                </p>
              ) : usage ? (
                (
                  providerConfig?.usageTiers?.map((t) => ({ key: t.key, label: t.label })) ??
                  DEFAULT_USAGE_TIERS.map((t) => ({ key: t.key, label: t.label }))
                ).map(({ key, label }) => {
                  const tier = getTier(usage, key);
                  if (!tier) return null;
                  return (
                    <UsageBarRow
                      key={key}
                      label={label}
                      utilization={tier.utilization}
                      resetsAt={tier.resets_at}
                    />
                  );
                })
              ) : (
                <p className="text-xs text-muted">Loading usage data…</p>
              )}
              {authMethod === 'claudeai' && (
                <button
                  type="button"
                  className="text-xs text-muted text-left bg-transparent border-none p-0 mt-1 cursor-pointer hover:underline"
                  onClick={() => openUrl(manageUrl)}
                >
                  Manage usage on claude.ai
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
