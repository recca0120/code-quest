import { describe, expect, it } from 'vitest';
import { filterTabsByWorktree } from '../tab-filter.ts';

const tabs = [
  { sessionId: 'ch-1', cwd: '/proj/main' },
  { sessionId: 'ch-2', cwd: '/proj/main' },
  { sessionId: 'ch-3', cwd: '/proj/feat' },
  { sessionId: 'ch-4', cwd: undefined },
];

describe('filterTabsByWorktree', () => {
  it('returns all tabs when selectedWorktreeCwd is null', () => {
    expect(filterTabsByWorktree(tabs, null)).toEqual(tabs);
  });

  it('returns all tabs when selectedWorktreeCwd is undefined', () => {
    expect(filterTabsByWorktree(tabs, undefined)).toEqual(tabs);
  });

  it('filters to only tabs matching selectedWorktreeCwd', () => {
    const result = filterTabsByWorktree(tabs, '/proj/main');
    expect(result.map((t) => t.sessionId)).toEqual(['ch-1', 'ch-2']);
  });

  it('returns tabs with undefined cwd when they match no worktree and no filter set', () => {
    expect(filterTabsByWorktree(tabs, null)).toContain(tabs[3]);
  });

  it('excludes tabs with undefined cwd when a worktree filter is active', () => {
    const result = filterTabsByWorktree(tabs, '/proj/main');
    expect(result.find((t) => t.sessionId === 'ch-4')).toBeUndefined();
  });

  it('returns empty array when no tabs match the selected worktree', () => {
    expect(filterTabsByWorktree(tabs, '/proj/other')).toEqual([]);
  });
});
