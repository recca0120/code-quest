import { describe, expect, it, vi } from 'vitest';
import { createQueryCache } from '../query-cache.ts';

function createStore() {
  const fetchFn = vi.fn<(cwd: string) => Promise<string>>();
  const store = createQueryCache<string>({ fetch: fetchFn, idPrefix: 'test' });
  return { store, fetchFn };
}

describe('createQueryCache', () => {
  it('get returns undefined before any fetch', () => {
    const { store } = createStore();
    expect(store.get('/a')).toBeUndefined();
  });

  it('subscribe triggers initial fetch and notifies on completion', async () => {
    const { store, fetchFn } = createStore();
    fetchFn.mockResolvedValue('result-a');

    const onChange = vi.fn();
    store.subscribe('/a', onChange);

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(store.get('/a')).toBe('result-a');
  });

  it('subscribe deduplicates inflight fetches for the same cwd', async () => {
    const { store, fetchFn } = createStore();
    fetchFn.mockResolvedValue('result-a');

    const onChange1 = vi.fn();
    const onChange2 = vi.fn();
    store.subscribe('/a', onChange1);
    store.subscribe('/a', onChange2);

    await vi.waitFor(() => expect(onChange1).toHaveBeenCalled());
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(onChange2).toHaveBeenCalled();
  });

  it('refetch updates cache and notifies subscribers', async () => {
    const { store, fetchFn } = createStore();
    fetchFn.mockResolvedValue('v1');

    const onChange = vi.fn();
    store.subscribe('/a', onChange);
    await vi.waitFor(() => expect(store.get('/a')).toBe('v1'));

    fetchFn.mockResolvedValue('v2');
    await store.refetch('/a');

    expect(store.get('/a')).toBe('v2');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('refetchIfSubscribed skips when no subscribers', async () => {
    const { store, fetchFn } = createStore();
    fetchFn.mockResolvedValue('v1');

    await store.refetchIfSubscribed('/a');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refetchIfSubscribed fetches when subscribers exist', async () => {
    const { store, fetchFn } = createStore();
    fetchFn.mockResolvedValue('v1');

    store.subscribe('/a', vi.fn());
    await vi.waitFor(() => expect(store.get('/a')).toBe('v1'));

    fetchFn.mockResolvedValue('v2');
    await store.refetchIfSubscribed('/a');
    expect(store.get('/a')).toBe('v2');
  });

  it('unsubscribe removes listener', async () => {
    const { store, fetchFn } = createStore();
    fetchFn.mockResolvedValue('v1');

    const onChange = vi.fn();
    const unsub = store.subscribe('/a', onChange);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    unsub();
    fetchFn.mockResolvedValue('v2');
    await store.refetch('/a');

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('setFetch replaces the fetch function used by subsequent refetches', async () => {
    const { store, fetchFn } = createStore();
    fetchFn.mockResolvedValue('v1');

    store.subscribe('/a', vi.fn());
    await vi.waitFor(() => expect(store.get('/a')).toBe('v1'));

    const newFetch = vi.fn<(cwd: string) => Promise<string>>().mockResolvedValue('v2-new');
    store.setFetch(newFetch);

    await store.refetch('/a');
    expect(store.get('/a')).toBe('v2-new');
    expect(newFetch).toHaveBeenCalledWith('/a');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('hasSubscribers returns correct state', async () => {
    const { store, fetchFn } = createStore();
    fetchFn.mockResolvedValue('v1');

    expect(store.hasSubscribers('/a')).toBe(false);

    const unsub = store.subscribe('/a', vi.fn());
    expect(store.hasSubscribers('/a')).toBe(true);

    unsub();
    expect(store.hasSubscribers('/a')).toBe(false);
  });

  describe('evict', () => {
    it('removes the cached entry for the given key', () => {
      const cache = createQueryCache({ fetch: async () => 'val', idPrefix: 'test' });
      cache.set('key1', 'value');
      expect(cache.get('key1')).toBe('value');
      cache.evict('key1');
      expect(cache.get('key1')).toBeUndefined();
    });

    it('is a no-op for a key that does not exist', () => {
      const cache = createQueryCache({ fetch: async () => 'val', idPrefix: 'test' });
      expect(() => cache.evict('nonexistent')).not.toThrow();
    });
  });

  it('subscribe logs error with key context when initial fetch rejects', async () => {
    const { store, fetchFn } = createStore();
    const error = new Error('network fail');
    fetchFn.mockRejectedValue(error);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    store.subscribe('/a', vi.fn());
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    const args = spy.mock.calls[0]!;
    expect(args).toContain('/a');
    expect(args).toContain(error);

    spy.mockRestore();
  });
});
