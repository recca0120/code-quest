import { describe, expect, it } from 'vitest';
import { midTruncate } from '../mid-truncate';

describe('midTruncate', () => {
  it('returns short strings unchanged', () => {
    expect(midTruncate('main')).toBe('main');
  });

  it('returns string unchanged when exactly at limit (22 chars)', () => {
    const str = 'a'.repeat(22);
    expect(midTruncate(str)).toBe(str);
  });

  it('does not truncate when string is one char under limit', () => {
    expect(midTruncate('a'.repeat(21))).toBe('a'.repeat(21));
  });

  it('truncates long strings with middle ellipsis', () => {
    // slice(0,14)='worktree-perf-', slice(-6)='-batch'
    expect(midTruncate('worktree-perf-commission-batch')).toBe('worktree-perf-…-batch');
  });

  it('truncates UUID-suffixed names showing start and end', () => {
    // slice(0,14)='worktree-agent', slice(-6)='face45'
    expect(midTruncate('worktree-agent-adf24b45165face45')).toBe('worktree-agent…face45');
  });

  it('truncates strings longer than 22 chars', () => {
    const str = 'a'.repeat(23);
    expect(midTruncate(str)).toContain('…');
    expect(midTruncate(str)).not.toBe(str);
  });
});
