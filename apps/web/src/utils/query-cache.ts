import { getOrSet, TopicEmitter } from '@code-quest/utils';

interface QueryCacheConfig<R> {
  fetch: (key: string) => Promise<R>;
  idPrefix: string;
}

interface QueryCache<R> {
  get: (key: string) => R | undefined;
  set: (key: string, value: R) => void;
  subscribe: (key: string, onChange: () => void) => () => void;
  refetch: (key: string) => Promise<void>;
  refetchIfSubscribed: (key: string) => Promise<void>;
  hasSubscribers: (key: string) => boolean;
  setFetch: (fn: (key: string) => Promise<R>) => void;
  evict: (key: string) => void;
}

export function createQueryCache<R>({
  fetch: fetchFn,
  idPrefix,
}: QueryCacheConfig<R>): QueryCache<R> {
  const emitter = new TopicEmitter<string, void>();
  const cache = new Map<string, R>();
  const inflight = new Map<string, Promise<void>>();
  let nextSubId = 0;
  let currentFetch = fetchFn;

  const refetch = async (key: string): Promise<void> => {
    cache.set(key, await currentFetch(key));
    emitter.publish(key, undefined);
  };

  return {
    get: (key) => cache.get(key),
    set: (key, value) => {
      cache.set(key, value);
      emitter.publish(key, undefined);
    },
    subscribe: (key, onChange) => {
      const off = emitter.subscribe(key, `${idPrefix}-${nextSubId++}`, onChange);
      if (!cache.has(key))
        getOrSet(inflight, key, () => refetch(key)).catch((e) =>
          console.error('[query-cache] refetch failed:', key, e),
        );
      return off;
    },
    refetch,
    refetchIfSubscribed: async (key) => {
      if (emitter.hasSubscribers(key)) await refetch(key);
    },
    hasSubscribers: (key) => emitter.hasSubscribers(key),
    setFetch: (fn) => {
      currentFetch = fn;
    },
    evict: (key) => {
      cache.delete(key);
    },
  };
}
