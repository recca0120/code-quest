import {
  contextUsageDataSchema,
  type McpServerInfo,
  mcpServerInfoSchema,
  type PermissionMode,
  toPermissionMode,
} from '@code-quest/schemas';
import * as Popover from '@radix-ui/react-popover';
import { useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { CommandMenu } from '@/components/chat/compose/command-menu/CommandMenu';
import { IconButton } from '@/components/ui/IconButton';
import { useAppConfig } from '@/contexts/AppInitContext';
import {
  useChannelCompose,
  useChannelConfig,
  useChannelId,
  useChannelMessages,
} from '@/contexts/channel';
import { modelOpenSignal } from '@/features/model/model-feature';
import { selectIsActive, useChannelStore } from '@/stores/ChannelStoreContext';
import { cn } from '@/utils/cn';
import { findModel, getEffortLevels } from '@/utils/model-utils';
import { type ActiveDialog, ToolbarDialogs } from '../dialogs/ToolbarDialogs.tsx';
import { AttachMenu } from './AttachMenu.tsx';
import { ContextPieChart } from './ContextPieChart.tsx';
import { PermissionModePicker } from './PermissionModePicker.tsx';

const DEFAULT_CONTEXT_WINDOW = 200_000;

function SendButton({
  mode,
  isProcessing,
  isCancelling,
  hasText,
  onAbort,
  onSubmit,
}: {
  mode: PermissionMode;
  isProcessing: boolean;
  isCancelling: boolean;
  hasText: boolean;
  onAbort: () => void;
  onSubmit: () => void;
}) {
  return (
    <IconButton
      variant="plain"
      title={isProcessing ? 'Stop' : 'Send'}
      disabled={isProcessing ? isCancelling : !hasText}
      data-mode={mode}
      onClick={isProcessing ? onAbort : onSubmit}
      className={cn(
        'bg-mode-accent text-selected-text',
        isProcessing
          ? 'text-xs disabled:opacity-50'
          : 'text-base disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      {isProcessing ? '■' : '↑'}
    </IconButton>
  );
}

import { ModelPickerPopover } from '../../settings/ModelPickerPopover';

const rawMcpServerSchema = z.object({
  name: z.string(),
  status: z.string(),
  scope: z.string().optional(),
});

const mcpStatusSchema = mcpServerInfoSchema.shape.status;

const toMcpServerInfo = (s: z.infer<typeof rawMcpServerSchema>): McpServerInfo => ({
  name: s.name,
  enabled: true,
  status: mcpStatusSchema.safeParse(s.status).data ?? 'disconnected',
  scope: s.scope,
});

function parseMcpServer(raw: unknown): McpServerInfo | null {
  const parsed = rawMcpServerSchema.safeParse(raw);
  return parsed.success ? toMcpServerInfo(parsed.data) : null;
}

async function fetchEnrichedMcpServers(
  mcpStatus: () => Promise<{ success: boolean; response?: { mcpServers?: unknown[] } }>,
): Promise<McpServerInfo[] | null> {
  try {
    const result = await mcpStatus();
    const servers = result.success ? result.response?.mcpServers : undefined;
    if (!Array.isArray(servers)) return null;
    return servers.map(parseMcpServer).filter((s): s is McpServerInfo => s !== null);
  } catch (e) {
    console.error('MCP refresh failed:', e);
    return null;
  }
}

interface ComposeToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAttachFile?: () => void;
}

export function ComposeToolbar({
  containerRef,
  onAttachFile,
}: ComposeToolbarProps): React.JSX.Element {
  const isProcessing = useChannelStore(selectIsActive);
  const isCancelling = useChannelStore((s) => s.status === 'cancelling');
  const stats = useChannelStore((s) => s.stats);
  const isContextCompressed = useChannelStore((s) => s.isContextCompressed);
  const { abort, rewindToMessage, forkSession } = useChannelMessages();
  const {
    accountInfo,
    usageQuota,
    contextUsage,
    permissionMode,
    model,
    availableModels,
    effort,
    mcpServers: channelMcpServers,
    mcpStatus,
    mcpToggle,
    mcpReconnect,
    mcpAuthenticate,
    mcpClearAuth,
    setModel,
    setPermissionMode,
    setEffort,
    providerConfig,
  } = useChannelConfig();
  const { initOptions, setInitOptions } = useAppConfig();
  const compose = useChannelCompose();

  const baseMcpServers = channelMcpServers.map(toMcpServerInfo);
  const [enrichedMcpServers, setEnrichedMcpServers] = useState<McpServerInfo[] | null>(null);
  const mcpRefresh = () => fetchEnrichedMcpServers(mcpStatus).then(setEnrichedMcpServers);
  const mcpServers = enrichedMcpServers ?? baseMcpServers;

  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const closeDialog = () => setActiveDialog(null);
  const openMcpStatus = () => {
    setActiveDialog('mcpStatus');
    if (!enrichedMcpServers) mcpRefresh();
  };

  const channelId = useChannelId();
  const isModelPickerOpen = useSyncExternalStore(
    (cb) => modelOpenSignal.subscribe(cb),
    () => modelOpenSignal.isOpenFor(channelId),
  );
  const modelEntry = (model ? findModel(model, availableModels) : undefined) ?? availableModels[0];
  const supportsAutoMode = modelEntry?.supportsAutoMode ?? false;
  const effortLevels = getEffortLevels(modelEntry);

  const contextPct =
    contextUsageDataSchema.safeParse(contextUsage).data?.percentage ??
    (stats?.inputTokens != null && stats.inputTokens > 0
      ? Math.min(
          Math.round((stats.inputTokens / (stats.contextWindow ?? DEFAULT_CONTEXT_WINDOW)) * 100),
          100,
        )
      : null);
  const showContextUsage = isContextCompressed || contextPct !== null;

  return (
    <>
      <ToolbarDialogs
        activeDialog={activeDialog}
        closeDialog={closeDialog}
        mcpServers={mcpServers}
        mcpToggle={mcpToggle}
        mcpReconnect={mcpReconnect}
        mcpRefresh={mcpRefresh}
        mcpAuthenticate={mcpAuthenticate}
        mcpClearAuth={mcpClearAuth}
        initOptions={initOptions}
        setInitOptions={setInitOptions}
        usageQuota={usageQuota}
        contextUsage={contextUsage}
        stats={stats}
        accountInfo={accountInfo}
        providerConfig={providerConfig}
        rewindToMessage={rewindToMessage}
        forkSession={forkSession}
        updateValue={compose.updateValue}
      />
      <Popover.Root
        open={isModelPickerOpen}
        onOpenChange={(open) => modelOpenSignal.setOpen(open, channelId)}
      >
        <Popover.Anchor virtualRef={containerRef as React.RefObject<Element>} />
        <div className="flex items-center gap-0.5 px-2 py-1 text-xs">
          {isModelPickerOpen && (
            <Popover.Content
              side="top"
              align="start"
              sideOffset={4}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onFocusOutside={(e) => e.preventDefault()}
              className="z-modal"
              style={{ width: 'var(--radix-popper-anchor-width)' }}
            >
              <ModelPickerPopover
                currentModel={model ?? null}
                availableModels={availableModels}
                onSwitch={(v) => {
                  setModel(v);
                  modelOpenSignal.setOpen(false, null);
                }}
                defaultModelDescription={providerConfig?.defaultModelDescription}
              />
            </Popover.Content>
          )}

          <AttachMenu onAttachFile={onAttachFile} onMentionFile={compose.mentionFile} />

          <CommandMenu
            containerRef={containerRef}
            onToggleMcp={() => setActiveDialog('manageMcp')}
            onMcpStatus={openMcpStatus}
            onManagePlugins={() => setActiveDialog('plugins')}
            onAttachFile={onAttachFile}
            docsUrl={providerConfig?.brand.docsUrl}
          />

          {showContextUsage && (
            <span className="text-muted shrink-0 flex items-center gap-0.5">
              {isContextCompressed ? (
                'compact'
              ) : (
                <>
                  <ContextPieChart pct={contextPct ?? 0} />
                  <span>{contextPct ?? 0}% used</span>
                </>
              )}
            </span>
          )}

          <div className="flex-1" />

          <PermissionModePicker
            mode={permissionMode ?? 'normal'}
            effort={effort ?? undefined}
            effortLevels={effortLevels}
            supportsAutoMode={supportsAutoMode}
            onSetPermissionMode={setPermissionMode}
            onSetEffort={setEffort}
          />

          <SendButton
            mode={toPermissionMode(permissionMode)}
            isProcessing={isProcessing}
            isCancelling={isCancelling}
            hasText={compose.hasText}
            onAbort={abort}
            onSubmit={compose.submit}
          />
        </div>
      </Popover.Root>
    </>
  );
}
