import { describe, expect, it } from 'vitest';
import { CIRCLED, formatWorktreeLabel } from '../pane-label';

describe('CIRCLED', () => {
  it('exports a 9-char string of circled digits ①–⑨', () => {
    expect(CIRCLED).toBe('①②③④⑤⑥⑦⑧⑨');
    expect(CIRCLED).toHaveLength(9);
  });
});

describe('formatWorktreeLabel', () => {
  it('branch 存在時回傳 branch', () => {
    expect(formatWorktreeLabel({ branch: 'feat/login', name: 'wt-1' })).toBe('feat/login');
  });

  it('branch 為 undefined 時 fallback 到 name', () => {
    expect(formatWorktreeLabel({ branch: undefined, name: 'main' })).toBe('main');
  });

  it('branch 為空字串時 fallback 到 name', () => {
    expect(formatWorktreeLabel({ name: 'detached' })).toBe('detached');
  });
});
