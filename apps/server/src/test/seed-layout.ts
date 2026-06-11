import type { PersistedLayout } from '@code-quest/schemas';
import type { Container } from 'inversify';
import type { ChannelManager } from '../socket/channel-manager.ts';
import type { LayoutStore } from '../socket/layout-store.ts';
import { TYPES } from '../types.ts';

/**
 * Seed a layout for the container's summoner. Tests must use this instead of
 * touching LayoutStore directly — it owns the summoner-key resolution and will
 * absorb the API change when LayoutStore goes async (persistence refactor).
 */
export async function seedLayout(container: Container, layout: PersistedLayout): Promise<void> {
  const summonerKey = container.get<ChannelManager>(TYPES.ChannelManager).provider;
  await container.get<LayoutStore>(TYPES.LayoutStore).set(summonerKey, layout);
}
