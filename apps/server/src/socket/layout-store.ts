import type { PersistedLayout } from '@code-quest/schemas';

export interface StoredLayout {
  layout: PersistedLayout;
  rev: number;
}

export interface LayoutStore {
  get(summonerId: string): Promise<StoredLayout | null>;
  set(summonerId: string, layout: PersistedLayout): Promise<number>;
}

export class InMemoryLayoutStore implements LayoutStore {
  private readonly store = new Map<string, StoredLayout>();

  async get(summonerId: string): Promise<StoredLayout | null> {
    return this.store.get(summonerId) ?? null;
  }

  async set(summonerId: string, layout: PersistedLayout): Promise<number> {
    const rev = (this.store.get(summonerId)?.rev ?? 0) + 1;
    this.store.set(summonerId, { layout, rev });
    return rev;
  }
}
