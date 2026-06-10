import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useState } from 'react';
import { useChannelConfig } from '@/contexts/channel';
import { usePlugins } from '@/contexts/PluginContext';
import { cn } from '@/utils/cn';
import { tabTrigger } from '../ui/_tokens.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';
import { InstalledPluginList } from './InstalledPluginList.tsx';
import { MarketplaceSection } from './MarketplaceSection.tsx';

interface ManagePluginsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ManagePluginsDialog({
  open,
  onClose,
}: ManagePluginsDialogProps): React.JSX.Element {
  const {
    installed,
    available,
    marketplaces,
    needsRestart,
    installing,
    refreshPlugins,
    refreshMarketplaces,
    install,
    uninstall,
    toggle,
    addMarketplace,
    removeMarketplace,
  } = usePlugins();
  const { providerConfig } = useChannelConfig();

  const [activeTab, setActiveTab] = useState<'plugins' | 'marketplaces'>('plugins');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMarketplaceSource, setNewMarketplaceSource] = useState('');
  const [adding, setAdding] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh fns are stable RPC wrappers
  useEffect(() => {
    if (!open) return;
    refreshPlugins();
    refreshMarketplaces();
  }, [open]);

  const handleAddMarketplace = async () => {
    if (!newMarketplaceSource.trim()) return;
    setAdding(true);
    await addMarketplace(newMarketplaceSource.trim());
    setNewMarketplaceSource('');
    setAdding(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Manage Plugins" size="lg">
        {needsRestart && (
          <div className="flex items-center justify-between bg-warning/15 border border-warning text-text rounded-md px-3 py-2.5 mb-3 text-xs">
            <span>Restart {providerConfig?.brand.name ?? 'Claude'} to apply plugin changes</span>
            <Button variant="info" size="xs" className="ml-3 px-2.5 py-1" disabled>
              Restart
            </Button>
          </div>
        )}

        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'plugins' | 'marketplaces')}
        >
          <Tabs.List className="flex border-b border-border gap-1 mb-3">
            {(
              [
                { id: 'plugins' as const, label: 'Plugins', count: installed.length },
                { id: 'marketplaces' as const, label: 'Marketplaces', count: marketplaces.length },
              ] as const
            ).map(({ id, label, count }) => (
              <Tabs.Trigger
                key={id}
                value={id}
                className={cn(
                  tabTrigger,
                  'px-3 py-2 text-sm -mb-px transition-colors',
                  'data-[state=active]:font-medium',
                )}
              >
                {label}
                {count > 0 && (
                  <Badge className="ml-1.5 bg-info text-selected-text rounded-lg">{count}</Badge>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="plugins" className="overflow-y-auto flex-1 min-h-0 h-100">
            <InstalledPluginList
              installed={installed}
              available={available}
              marketplaces={marketplaces}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onToggle={toggle}
              onUninstall={uninstall}
              onInstall={install}
              installing={installing}
            />
          </Tabs.Content>

          <Tabs.Content value="marketplaces" className="overflow-y-auto flex-1 min-h-0 h-100">
            <MarketplaceSection
              marketplaces={marketplaces}
              newSource={newMarketplaceSource}
              onNewSourceChange={setNewMarketplaceSource}
              onAdd={handleAddMarketplace}
              onRemove={removeMarketplace}
              onRefresh={refreshMarketplaces}
              adding={adding}
            />
          </Tabs.Content>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}
