import { describe, expect, it } from 'vitest';
import { isPathWithin } from '../is-path-within.ts';

describe('isPathWithin', () => {
  it('returns true for the root itself', () => {
    expect(isPathWithin('/root', '/root')).toBe(true);
  });

  it('returns true for a direct child', () => {
    expect(isPathWithin('/root', '/root/child')).toBe(true);
  });

  it('returns true for a deeply nested path', () => {
    expect(isPathWithin('/root', '/root/a/b/c')).toBe(true);
  });

  it('returns false for a path outside the root', () => {
    expect(isPathWithin('/root', '/other')).toBe(false);
  });

  it('returns false for a parent of the root', () => {
    expect(isPathWithin('/root', '/')).toBe(false);
  });

  it('returns false for prefix-similar but not inside (foo vs foo-bar)', () => {
    expect(isPathWithin('/foo', '/foo-bar')).toBe(false);
    expect(isPathWithin('/foo', '/foo-bar/x')).toBe(false);
  });

  it('returns false for path traversal via ../..', () => {
    expect(isPathWithin('/root', '/root/../../etc')).toBe(false);
  });

  it('resolves relative paths before comparing', () => {
    expect(isPathWithin('/root', '/root/sub/../other')).toBe(true);
  });
});
