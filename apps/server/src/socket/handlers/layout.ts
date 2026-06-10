import type { SocketCallback, TypedSocket } from '@code-quest/schemas';
import { EVENTS, migrateLegacyToV2, persistedLayoutSchema } from '@code-quest/schemas';
import { logger } from '../../logger.ts';
import type { HandlerContext } from '../../types.ts';
import type { Channel } from '../channel.ts';

const LAYOUT_SUMMONER_KEY = 'default';

export function create({
  emitter,
  layoutStore,
}: Pick<HandlerContext, 'emitter' | 'layoutStore'>): void {
  function handleSave(
    _ch: Channel | null,
    payload: unknown,
    socket?: TypedSocket,
    _callback?: SocketCallback,
  ): void {
    const parsed = persistedLayoutSchema.safeParse(migrateLegacyToV2(payload));
    if (!parsed.success) {
      logger.warn({ err: parsed.error.message }, 'layout:save rejected: invalid payload');
      return;
    }

    layoutStore.set(LAYOUT_SUMMONER_KEY, parsed.data);

    if (socket) {
      emitter.broadcastAllExcept(socket.id, EVENTS.layout.sync, parsed.data);
    }
  }

  emitter.on(EVENTS.layout.save, handleSave);
}
