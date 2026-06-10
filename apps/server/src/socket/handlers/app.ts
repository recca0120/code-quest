import type { PersistedLayout, SocketCallback, TypedSocket } from '@code-quest/schemas';
import { EVENTS } from '@code-quest/schemas';
import { logger } from '../../logger.ts';
import type { HandlerContext } from '../../types.ts';
import type { Channel } from '../channel.ts';
import { SETTINGS_STATE_KEYS } from './settings.ts';

function storedLayoutToWire(
  stored: { layout: PersistedLayout; rev: number } | null,
): (PersistedLayout & { rev: number }) | null {
  return stored ? { ...stored.layout, rev: stored.rev } : null;
}

export function create({
  channelManager,
  settingsStore,
  emitter,
  gitService,
  layoutStore,
}: Pick<
  HandlerContext,
  'channelManager' | 'settingsStore' | 'emitter' | 'gitService' | 'layoutStore'
>): void {
  async function handleInit(
    _ch: Channel | null,
    _payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const sessions = channelManager.getAliveChannels().map(([id, ch]) => ({
      channelId: id,
      state: ch.isProcessing ? 'busy' : 'idle',
      title: ch.title,
      cwd: ch.cwd,
      projectRoot: ch.projectRoot ?? ch.cwd,
    }));
    logger.debug({ sessionCount: sessions.length }, 'returning sessions');
    let settings: Record<string, unknown> = {};
    try {
      settings = await settingsStore.getMany(channelManager.provider, [...SETTINGS_STATE_KEYS]);
    } catch (err) {
      logger.debug({ err }, 'Settings table may not exist yet');
    }
    callback?.({
      settings,
      sessions,
      models: channelManager.cachedModels,
      state: {
        platform: process.platform,
        speechToTextEnabled: false,
        browserIntegrationSupported: false,
      },
      capabilities: { worktree: gitService.capabilities.worktree },
      layout: storedLayoutToWire(layoutStore.get(channelManager.provider)),
    });
  }

  async function handleConfig(
    _ch: Channel | null,
    _payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    let models: unknown[] | undefined = channelManager.cachedModels;
    let effort: unknown;
    try {
      if (!models) {
        const raw = await settingsStore.get(channelManager.provider, 'models');
        if (Array.isArray(raw)) models = raw;
      }
      effort = await settingsStore.get(channelManager.provider, 'effortLevel');
    } catch (err) {
      logger.debug({ err }, 'Settings table may not exist yet');
    }
    callback?.({
      providerConfig: channelManager.providerClientConfig,
      ...(models ? { models } : {}),
      ...(typeof effort === 'string' ? { effort } : {}),
    });
  }

  function handleDisconnect(_ch: Channel | null, _payload: unknown, socket?: TypedSocket): void {
    if (socket) {
      channelManager.removeSocketFromAll(socket.id);
    }
  }

  emitter.on(EVENTS.app.init, handleInit);
  emitter.on(EVENTS.app.config, handleConfig);
  emitter.on('disconnect', handleDisconnect);
}
