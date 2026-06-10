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
  function handleSave(
    _ch: Channel | null,
    payload: unknown,
    socket?: TypedSocket,
    callback?: SocketCallback,
  ): void {
    // No migration on the write path: a stale (unversioned v1) client must not
    // downgrade stored v2 data — its write is rejected and observable via ack.
    const parsed = persistedLayoutSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ err: parsed.error.message }, 'layout:save rejected: invalid payload');
      callback?.({ ok: false, error: 'invalid layout payload' });
      return;
    }

    // Enforce the channelId-uniqueness invariant at the wire boundary
    const layout = dedupeLayoutChannelIds(parsed.data);
    // Per-summoner isolation: keyed by the provider identity (same namespace as
    // settingsStore); all sockets of this server belong to the same summoner,
    // so broadcastAllExcept below is already summoner-scoped.
    const rev = layoutStore.set(channelManager.provider, layout);
    callback?.({ ok: true, rev });

    if (socket) {
      emitter.broadcastAllExcept(socket.id, EVENTS.layout.sync, { ...layout, rev });
    }
  }

  emitter.on(EVENTS.layout.save, handleSave);
}
