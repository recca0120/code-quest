import type { SocketCallback, TypedSocket } from '@code-quest/schemas';
import { EVENTS, persistedLayoutSchema } from '@code-quest/schemas';
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
    const parsed = persistedLayoutSchema.safeParse(payload);
    if (!parsed.success) return;

    layoutStore.set(LAYOUT_SUMMONER_KEY, parsed.data);

    if (socket) {
      emitter.broadcastAllExcept(socket.id, EVENTS.layout.sync, parsed.data);
    }
  }

  emitter.on(EVENTS.layout.save, handleSave);
}
