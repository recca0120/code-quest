import { FakeFileWatcher } from '@code-quest/test-kit';
import { describe, expect, it, vi } from 'vitest';

describe('FakeFileWatcher', () => {
  it('simulate fans out to all subscribers on that cwd', () => {
    const service = new FakeFileWatcher();
    const a = vi.fn();
    const b = vi.fn();
    service.subscribe('/repo', a);
    service.subscribe('/repo', b);
    service.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
    expect(a).toHaveBeenCalledWith({ type: 'change', path: 'src/foo.ts' });
    expect(b).toHaveBeenCalledWith({ type: 'change', path: 'src/foo.ts' });
  });

  it('unsubscribe stops further callbacks', () => {
    const service = new FakeFileWatcher();
    const cb = vi.fn();
    const off = service.subscribe('/repo', cb);
    off();
    service.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple cwds are independent', () => {
    const service = new FakeFileWatcher();
    const a = vi.fn();
    const b = vi.fn();
    service.subscribe('/repo-a', a);
    service.subscribe('/repo-b', b);
    service.simulate('/repo-a', { type: 'change', path: 'x' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('a throwing subscriber does not break others', () => {
    const service = new FakeFileWatcher();
    const thrower = vi.fn(() => {
      throw new Error('boom');
    });
    const healthy = vi.fn();
    service.subscribe('/repo', thrower);
    service.subscribe('/repo', healthy);
    expect(() => service.simulate('/repo', { type: 'change', path: 'x' })).not.toThrow();
    expect(healthy).toHaveBeenCalledWith({ type: 'change', path: 'x' });
  });

  it('idempotent unsubscribe — second call is a no-op', () => {
    const service = new FakeFileWatcher();
    const cb = vi.fn();
    const off = service.subscribe('/repo', cb);
    off();
    expect(() => off()).not.toThrow();
    service.simulate('/repo', { type: 'change', path: 'x' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('simulate on cwd with no subscribers is a no-op', () => {
    const service = new FakeFileWatcher();
    expect(() => service.simulate('/nowhere', { type: 'change', path: 'x' })).not.toThrow();
  });

  it('refcount: subscribers on same cwd observed via simulate', () => {
    const service = new FakeFileWatcher();
    const a = vi.fn();
    const b = vi.fn();
    const offA = service.subscribe('/repo', a);
    service.subscribe('/repo', b);
    service.simulate('/repo', { type: 'change', path: 'x' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    service.simulate('/repo', { type: 'change', path: 'y' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});
