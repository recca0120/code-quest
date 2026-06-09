import type { McpServerInfo, ProviderClientConfig } from '@code-quest/schemas';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/settings/AuthDialog';
import { InitOptionsDialog } from '@/components/settings/InitOptionsDialog';
import { ManageMcpDialog } from '@/components/settings/ManageMcpDialog';
import { ManagePluginsDialog } from '@/components/settings/ManagePluginsDialog';
import { useChannelId } from '@/contexts/channel';
import type { ChannelConfigValue } from '@/contexts/channel/ChannelConfigContext';
import type { ChannelActionsValue } from '@/contexts/channel/ChannelMessagesContext';
import { generalConfigSignal } from '@/features/general-config/general-config-feature';
import { RewindDialog } from '@/features/rewind/RewindDialog';
import { rewindOpenSignal } from '@/features/rewind/rewind-feature';
import { switchAccountSignal } from '@/features/switch-account/switch-account-feature';
import { AccountUsageDialog } from '@/features/usage/AccountUsageDialog';
import { usageOpenSignal } from '@/features/usage/usage-feature';
import type { ChannelState } from '@/types/chat';

export type ActiveDialog = 'modelPicker' | 'manageMcp' | 'mcpStatus' | 'plugins' | null;

interface ToolbarDialogsProps {
  activeDialog: ActiveDialog;
  closeDialog: () => void;
  mcpServers: McpServerInfo[];
  mcpToggle: ChannelConfigValue['mcpToggle'];
  mcpReconnect: ChannelConfigValue['mcpReconnect'];
  mcpRefresh: () => Promise<void>;
  mcpAuthenticate: ChannelConfigValue['mcpAuthenticate'];
  mcpClearAuth: ChannelConfigValue['mcpClearAuth'];
  initOptions: Record<string, unknown>;
  setInitOptions: (opts: Record<string, unknown>) => void;
  usageQuota: ChannelConfigValue['usageQuota'];
  contextUsage: ChannelConfigValue['contextUsage'];
  stats: ChannelState['stats'];
  accountInfo: ChannelConfigValue['accountInfo'];
  providerConfig: ProviderClientConfig | undefined;
  rewindToMessage: ChannelActionsValue['rewindToMessage'];
  forkSession: ChannelActionsValue['forkSession'];
  updateValue: (value: string) => void;
}

export function ToolbarDialogs({
  activeDialog,
  closeDialog,
  mcpServers,
  mcpToggle,
  mcpReconnect,
  mcpRefresh,
  mcpAuthenticate,
  mcpClearAuth,
  initOptions,
  setInitOptions,
  usageQuota,
  contextUsage,
  stats,
  accountInfo,
  providerConfig,
  rewindToMessage,
  forkSession,
  updateValue,
}: ToolbarDialogsProps): React.JSX.Element {
  const channelId = useChannelId();
  const isUsageOpen = useSyncExternalStore(
    (cb) => usageOpenSignal.subscribe(cb),
    () => usageOpenSignal.isOpenFor(channelId),
  );
  const isRewindOpen = useSyncExternalStore(
    (cb) => rewindOpenSignal.subscribe(cb),
    () => rewindOpenSignal.isOpenFor(channelId),
  );
  const isGeneralConfigOpen = useSyncExternalStore(
    (cb) => generalConfigSignal.subscribe(cb),
    () => generalConfigSignal.isOpenFor('__global__'),
  );
  const isSwitchAccountOpen = useSyncExternalStore(
    (cb) => switchAccountSignal.subscribe(cb),
    () => switchAccountSignal.isOpenFor('__global__'),
  );
  return (
    <>
      {activeDialog === 'manageMcp' && (
        <ManageMcpDialog
          open
          onClose={closeDialog}
          servers={mcpServers}
          onToggle={async (name, enabled) => {
            await mcpToggle(name, enabled);
            mcpRefresh();
          }}
          onReconnect={async (name) => {
            await mcpReconnect(name);
            mcpRefresh();
          }}
          onRefresh={mcpRefresh}
          onAuthenticate={mcpAuthenticate}
          onClearAuth={mcpClearAuth}
        />
      )}
      {activeDialog === 'mcpStatus' && (
        <ManageMcpDialog open onClose={closeDialog} servers={mcpServers} />
      )}
      {isGeneralConfigOpen && (
        <InitOptionsDialog
          open
          onClose={() => generalConfigSignal.setOpen(false, null)}
          onSave={(opts) => setInitOptions(opts)}
          initial={initOptions}
        />
      )}
      {isUsageOpen && (
        <AccountUsageDialog
          open
          onClose={() => usageOpenSignal.setOpen(false, null)}
          usage={usageQuota ?? undefined}
          contextUsage={contextUsage ?? undefined}
          stats={stats ?? undefined}
          model={accountInfo?.model}
          authMethod={accountInfo?.authMethod}
          email={accountInfo?.email}
          organization={accountInfo?.organization}
          subscriptionType={accountInfo?.subscriptionType}
          providerConfig={providerConfig}
        />
      )}
      {activeDialog === 'plugins' && <ManagePluginsDialog open onClose={closeDialog} />}
      {isSwitchAccountOpen && (
        <AuthDialog open onClose={() => switchAccountSignal.setOpen(false, null)} />
      )}
      {isRewindOpen && (
        <RewindDialog
          open
          onClose={() => rewindOpenSignal.setOpen(false, null)}
          onConfirm={({ messageId, promptText }) => {
            rewindOpenSignal.setOpen(false, null);
            rewindToMessage(messageId)
              .then((result) => {
                if (result.ok && result.data.canRewind) {
                  forkSession(messageId).catch((err) => {
                    console.error('Fork session failed:', err);
                    toast.error('Failed to fork session');
                  });
                  updateValue(promptText);
                } else {
                  const errMessage = result.ok ? result.data.error : result.error;
                  toast.error(errMessage ?? 'Failed to rewind');
                }
              })
              .catch((err) => {
                console.error('Rewind failed:', err);
                toast.error('Failed to rewind');
              });
          }}
        />
      )}
    </>
  );
}
