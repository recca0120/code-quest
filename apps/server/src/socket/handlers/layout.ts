import type { SocketCallback, TypedSocket } from '@code-quest/schemas';
import { dedupeLayoutChannelIds, EVENTS, persistedLayoutSchema } from '@code-quest/schemas';
import { logger } from '../../logger.ts';
import type { HandlerContext } from '../../types.ts';
import type { Channel } from '../channel.ts';

export function create({
  emitter,
  layoutStore,
  channelManager,
}: Pick<HandlerContext, 'emitter' | 'layoutStore' | 'channelManager'>): void {
  async function handleSave(
    _ch: Channel | null,
    payload: unknown,
    socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = persistedLayoutSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ err: parsed.error.message }, 'layout:save rejected: invalid payload');
      callback?.({ ok: false, error: 'invalid layout payload' });
      return;
    }

    const layout = dedupeLayoutChannelIds(parsed.data);
    const rev = await layoutStore.set(channelManager.provider, layout);
    callback?.({ ok: true, rev });

    if (socket) {
      emitter.broadcastAllExcept(socket.id, EVENTS.layout.sync, { ...layout, rev });
    }
  }

  emitter.on(EVENTS.layout.save, handleSave);
}
