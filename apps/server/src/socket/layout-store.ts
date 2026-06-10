import type { PersistedLayout } from '@code-quest/schemas';

export class LayoutStore {
  private readonly store = new Map<string, PersistedLayout>();

  get(summonerId: string): PersistedLayout | null {
    return this.store.get(summonerId) ?? null;
  }

  set(summonerId: string, layout: PersistedLayout): void {
    this.store.set(summonerId, layout);
  }
}
