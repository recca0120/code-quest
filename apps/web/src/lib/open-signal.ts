export interface OpenSignal {
  isOpenFor(channelId: string): boolean;
  subscribe(cb: () => void): () => void;
  setOpen(open: boolean, channelId: string | null): void;
}

export function createOpenSignal(): OpenSignal {
  let openChannelId: string | null = null;
  const subscribers = new Set<() => void>();

  return {
    isOpenFor(channelId) {
      return openChannelId === channelId;
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    setOpen(open, channelId) {
      const next = open ? channelId : null;
      if (openChannelId === next) return;
      openChannelId = next;
      for (const cb of subscribers) cb();
    },
  };
}
