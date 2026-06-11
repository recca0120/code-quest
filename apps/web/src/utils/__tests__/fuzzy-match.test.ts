import { describe, expect, it } from 'vitest';
import { fuzzyMatch, highlightByIndices } from '../fuzzy-match';

describe('fuzzyMatch', () => {
  it('連續子序列匹配：cd → Clay Dark', () => {
    const result = fuzzyMatch('cd', 'Clay Dark');
    expect(result.match).toBe(true);
    expect(result.indices).toEqual([0, 5]);
  });

  it('不匹配：xyz → 切換主題：Clay Dark', () => {
    const result = fuzzyMatch('xyz', '切換主題：Clay Dark');
    expect(result.match).toBe(false);
  });

  it('空 query 全匹配', () => {
    const result = fuzzyMatch('', '任意文字');
    expect(result.match).toBe(true);
    expect(result.indices).toEqual([]);
  });

  it('大小寫不敏感', () => {
    const result = fuzzyMatch('TM', 'theme');
    expect(result.match).toBe(true);
  });

  it('fuzzy 子序列：tm 匹配 theme（t→m 跳過 h,e）', () => {
    const result = fuzzyMatch('tm', 'theme');
    expect(result.match).toBe(true);
    expect(result.indices).toEqual([0, 3]);
  });

  it('fuzzy 子序列：te 匹配 theme', () => {
    const result = fuzzyMatch('te', 'theme');
    expect(result.match).toBe(true);
    expect(result.indices).toEqual([0, 2]);
  });
});

describe('highlightByIndices', () => {
  it('標記指定位置字元', () => {
    const parts = highlightByIndices('hello', [1, 3]);
    expect(parts).toEqual([
      { text: 'h', match: false },
      { text: 'e', match: true },
      { text: 'l', match: false },
      { text: 'l', match: true },
      { text: 'o', match: false },
    ]);
  });

  it('空 indices → 全部 plain', () => {
    const parts = highlightByIndices('abc', []);
    expect(parts).toEqual([{ text: 'abc', match: false }]);
  });

  it('連續命中合併', () => {
    const parts = highlightByIndices('hello', [0, 1, 2]);
    expect(parts).toEqual([
      { text: 'hel', match: true },
      { text: 'lo', match: false },
    ]);
  });
});
