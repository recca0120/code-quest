import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenSignal } from '../open-signal.ts';

describe('createOpenSignal', () => {
  let signal: ReturnType<typeof createOpenSignal>;

  beforeEach(() => {
    signal = createOpenSignal();
  });

  it('isOpenFor returns false by default', () => {
    expect(signal.isOpenFor('ch-1')).toBe(false);
  });

  it('isOpenFor returns true only for the target channelId', () => {
    signal.setOpen(true, 'ch-1');
    expect(signal.isOpenFor('ch-1')).toBe(true);
    expect(signal.isOpenFor('ch-2')).toBe(false);
  });

  it('setOpen(false, null) closes for all channels', () => {
    signal.setOpen(true, 'ch-1');
    signal.setOpen(false, null);
    expect(signal.isOpenFor('ch-1')).toBe(false);
  });

  it('setOpen with same channelId and same value does not notify', () => {
    const cb = vi.fn();
    const unsub = signal.subscribe(cb);
    signal.setOpen(true, 'ch-1');
    cb.mockClear();
    signal.setOpen(true, 'ch-1'); // same
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it('switching from ch-1 to ch-2 notifies subscribers', () => {
    const cb = vi.fn();
    signal.setOpen(true, 'ch-1');
    const unsub = signal.subscribe(cb);
    signal.setOpen(true, 'ch-2');
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('subscribe returns unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = signal.subscribe(cb);
    unsub();
    signal.setOpen(true, 'ch-1');
    expect(cb).not.toHaveBeenCalled();
  });

  it('setOpen(false, null) from already-closed state does not notify', () => {
    const cb = vi.fn();
    const unsub = signal.subscribe(cb);
    signal.setOpen(false, null); // already null
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });
});
