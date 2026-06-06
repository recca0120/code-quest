import { FakeFileWatcher } from '@code-quest/test-kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from '../data-source.ts';

class TestDataSource extends DataSource<void> {
  constructor(watch: FakeFileWatcher, debounceMs?: number) {
    super('/repo', watch, () => true, debounceMs);
  }
  async read(): Promise<void> {}
}

function makeDs(debounceMs?: number) {
  const watch = new FakeFileWatcher();
  const ds = new TestDataSource(watch, debounceMs);
  const cb = vi.fn();
  ds.onChange(cb);
  return { watch, ds, cb };
}

function fire(watch: FakeFileWatcher) {
  watch.simulate('/repo', { type: 'change', path: 'src/a.ts' });
}

describe('DataSource debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not fire callback immediately after a single event', () => {
    const { watch, cb } = makeDs();
    fire(watch);
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires callback once after the debounce window', () => {
    const { watch, cb } = makeDs();
    fire(watch);
    vi.advanceTimersByTime(80);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('coalesces a burst into a single callback', () => {
    const { watch, cb } = makeDs();
    fire(watch);
    fire(watch);
    fire(watch);
    vi.advanceTimersByTime(80);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('fires independently for two bursts separated by more than the window', () => {
    const { watch, cb } = makeDs();
    fire(watch);
    vi.advanceTimersByTime(80);
    fire(watch);
    vi.advanceTimersByTime(80);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('dispose cancels a pending debounce timer', () => {
    const { watch, ds, cb } = makeDs();
    fire(watch);
    ds.dispose();
    vi.advanceTimersByTime(80);
    expect(cb).not.toHaveBeenCalled();
  });
});
