import { describe, expect, it } from 'vitest';
import { GIT_STATUS_MARKS, gitStatusMark } from '../git-status.ts';

describe('GIT_STATUS_MARKS', () => {
  it('defines all known status codes', () => {
    expect(GIT_STATUS_MARKS).toHaveProperty('M');
    expect(GIT_STATUS_MARKS).toHaveProperty('A');
    expect(GIT_STATUS_MARKS).toHaveProperty('D');
    expect(GIT_STATUS_MARKS).toHaveProperty('R');
    expect(GIT_STATUS_MARKS).toHaveProperty('??');
    expect(GIT_STATUS_MARKS).toHaveProperty('U');
  });

  it('each entry has mark and cls', () => {
    for (const entry of Object.values(GIT_STATUS_MARKS)) {
      expect(entry).toHaveProperty('mark');
      expect(entry).toHaveProperty('cls');
    }
  });
});

describe('gitStatusMark — cls field', () => {
  it('returns known class for M', () => {
    expect(gitStatusMark('M').cls).toBe('text-warning');
  });

  it('returns known class for ??', () => {
    expect(gitStatusMark('??').cls).toBe('text-success/70');
  });

  it('returns fallback class for unknown status', () => {
    expect(gitStatusMark('X').cls).toBe('text-muted');
  });
});

describe('gitStatusMark', () => {
  it('returns mark and cls for known status', () => {
    const result = gitStatusMark('A');
    expect(result.mark).toBe('A');
    expect(result.cls).toBe('text-success');
  });

  it('returns first char and muted class for unknown status', () => {
    const result = gitStatusMark('XY');
    expect(result.mark).toBe('X');
    expect(result.cls).toBe('text-muted');
  });

  it('returns dot and muted class for empty string', () => {
    const result = gitStatusMark('');
    expect(result.mark).toBe('·');
    expect(result.cls).toBe('text-muted');
  });
});
