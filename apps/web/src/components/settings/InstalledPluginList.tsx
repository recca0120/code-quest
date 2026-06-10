import type { AvailablePlugin, MarketplaceInfo, PluginInfo } from '@code-quest/schemas';
import { useState } from 'react';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { useChannelConfig } from '@/contexts/channel';
import { formatTokens } from '@/utils/format-number';
import { Button } from '../ui/Button.tsx';
import { GroupHeader } from '../ui/GroupHeader.tsx';
import { BorderedIconButton, TrashIcon } from '../ui/Icons.tsx';
import { StatusDot } from '../ui/StatusDot.tsx';
import { SurfaceCard } from '../ui/SurfaceCard.tsx';
import { ToggleSwitch } from '../ui/ToggleSwitch.tsx';

function pluginDisplayName(id: string): string {
  return id.split('@')[0] ?? id;
}

function formatInstallCount(n: number): string {
  return `${formatTokens(n)} installs`;
}

interface InstalledPluginListProps {
  installed: PluginInfo[];
  available: AvailablePlugin[];
  marketplaces: MarketplaceInfo[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onUninstall: (pluginId: string) => void;
  onInstall: (pluginId: string, scope: 'user' | 'project' | 'local') => void;
  installing: string | null;
}

export function InstalledPluginList({
  installed,
  available,
  marketplaces,
  searchQuery,
  onSearchChange,
  onToggle,
  onUninstall,
  onInstall,
  installing,
}: InstalledPluginListProps): React.JSX.Element {
  const { providerConfig } = useChannelConfig();
  const [selectedForInstall, setSelectedForInstall] = useState<string | null>(null);

  const installedIds = new Set(installed.map((p) => p.id));
  const filteredInstalled = installed.filter(
    (p) =>
      !searchQuery || pluginDisplayName(p.id).toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredAvailable = available.filter(
    (p) =>
      !installedIds.has(p.pluginId) &&
      (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <>
      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search plugins…"
          className="w-full border border-border bg-input text-text placeholder:text-muted rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {filteredInstalled.length > 0 && (
        <>
          <GroupHeader>Installed</GroupHeader>
          <ul className="list-none m-0 p-0">
            {filteredInstalled.map((plugin) => (
              <SurfaceCard
                as="li"
                key={plugin.id}
                className="flex items-center justify-between rounded-md mb-2"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <StatusDot
                    color={plugin.enabled ? 'success' : 'muted'}
                    className="w-2 h-2 inline-block mr-2"
                  />
                  <span className="text-text font-medium text-sm truncate">
                    {pluginDisplayName(plugin.id)}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <ToggleSwitch
                    isOn={plugin.enabled ?? false}
                    onClick={() => onToggle(plugin.id, plugin.enabled ?? false)}
                  />
                  <BorderedIconButton
                    onClick={() => onUninstall(plugin.id)}
                    label="Uninstall plugin"
                    danger
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </BorderedIconButton>
                </div>
              </SurfaceCard>
            ))}
          </ul>
        </>
      )}

      {filteredAvailable.length > 0 && (
        <>
          <GroupHeader>Available</GroupHeader>
          <ul className="list-none m-0 p-0">
            {filteredAvailable.map((plugin) => (
              <AvailablePluginCard
                key={plugin.pluginId}
                plugin={plugin}
                marketplaces={marketplaces}
                brandName={providerConfig?.brand.name ?? 'Claude'}
                brandCompany={providerConfig?.brand.company ?? 'Anthropic'}
                isSelected={selectedForInstall === plugin.pluginId}
                isInstalling={installing === plugin.pluginId}
                onSelect={() => setSelectedForInstall(plugin.pluginId)}
                onCancel={() => setSelectedForInstall(null)}
                onInstall={(scope) => {
                  setSelectedForInstall(null);
                  onInstall(plugin.pluginId, scope);
                }}
              />
            ))}
          </ul>
        </>
      )}

      {filteredInstalled.length === 0 && filteredAvailable.length === 0 && (
        <p className="text-center text-subtle py-8 text-sm">No plugins found.</p>
      )}
    </>
  );
}

const INSTALL_SCOPES = [
  { scope: 'user' as const, label: 'Install for you', desc: 'Available in all your projects' },
  {
    scope: 'project' as const,
    label: 'Install for this project',
    desc: 'Shared with all collaborators',
  },
  { scope: 'local' as const, label: 'Install locally', desc: 'Only for you, only in this repo' },
];

function AvailablePluginCard({
  plugin,
  marketplaces,
  brandName,
  brandCompany,
  isSelected,
  isInstalling,
  onSelect,
  onCancel,
  onInstall,
}: {
  plugin: AvailablePlugin;
  marketplaces: MarketplaceInfo[];
  brandName: string;
  brandCompany: string;
  isSelected: boolean;
  isInstalling: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onInstall: (scope: 'user' | 'project' | 'local') => void;
}): React.JSX.Element {
  const marketplace = marketplaces.find((m) => m.name === plugin.marketplaceName);
  const isOfficial =
    marketplace?.config.source.source === 'github' &&
    marketplace.config.source.repo === 'anthropics/claude-plugins-official';

  return (
    <SurfaceCard as="li" className="rounded-md mb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-text font-medium text-sm">{plugin.name}</span>
            {plugin.installCount != null && plugin.installCount > 0 && (
              <span className="text-muted text-xs">{formatInstallCount(plugin.installCount)}</span>
            )}
          </div>
          {plugin.description && (
            <p className="text-muted text-xs m-0 mb-1">{plugin.description}</p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>from {plugin.marketplaceName}</span>
            {isOfficial && (
              <span title={`Official ${brandName} Code marketplace`} className="text-info">
                ✓
              </span>
            )}
          </div>
        </div>
        {!isSelected && (
          <Button
            variant="info"
            size="sm"
            disabled={isInstalling}
            className="shrink-0"
            onClick={onSelect}
          >
            {isInstalling ? 'Installing…' : 'Install'}
          </Button>
        )}
      </div>
      {isSelected && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-xs text-muted mb-2">
            Make sure you trust a plugin before installing. {brandCompany} does not control what MCP
            servers, files, or other software are included in plugins.
          </p>
          {INSTALL_SCOPES.map(({ scope, label, desc }) => (
            <button
              key={scope}
              type="button"
              onClick={() => onInstall(scope)}
              className="w-full text-left px-2.5 py-2 rounded border border-border mb-1 hover:bg-bg transition-colors"
            >
              <div className="text-sm font-medium text-text">{label}</div>
              <div className="text-xs text-muted">{desc}</div>
            </button>
          ))}
          <InlineAction className="mt-1" onClick={onCancel}>
            Cancel
          </InlineAction>
        </div>
      )}
    </SurfaceCard>
  );
}
