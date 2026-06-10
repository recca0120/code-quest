import type { PersistedLayout } from '@code-quest/schemas';

interface StoredLayout {
  layout: PersistedLayout;
  rev: number;
}

export class LayoutStore {
  private readonly store = new Map<string, StoredLayout>();

  get(summonerId: string): StoredLayout | null {
    return this.store.get(summonerId) ?? null;
  }

  /** Stores the layout and returns the new monotonically increasing rev (echo guard). */
  set(summonerId: string, layout: PersistedLayout): number {
    const rev = (this.store.get(summonerId)?.rev ?? 0) + 1;
    this.store.set(summonerId, { layout, rev });
    return rev;
  }
}
