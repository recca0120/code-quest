import { describe, expect, it } from 'vitest';
import { formatTokenCount } from '../format-number.ts';

describe('formatTokenCount', () => {
  it('returns null for 0', () => expect(formatTokenCount(0)).toBeNull());
  it('returns null for negative', () => expect(formatTokenCount(-1)).toBeNull());
  it('formats < 1000 as "N tokens"', () => expect(formatTokenCount(500)).toBe('500 tokens'));
  it('formats >= 1000 as "N.Xk tokens"', () => expect(formatTokenCount(1200)).toBe('1.2k tokens'));
  it('formats exactly 1000 as "1.0k tokens"', () =>
    expect(formatTokenCount(1000)).toBe('1.0k tokens'));
});
