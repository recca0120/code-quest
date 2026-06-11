import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCommandFeatures } from '@/components/workspace/useCommandFeatures';

describe('useCommandFeatures', () => {
  it('returns feature items containing at least theme, font-size, density, search', () => {
    const { result } = renderHook(() => useCommandFeatures());
    const ids = result.current.map((f) => f.id);
    expect(ids.some((id) => id.includes('color-theme'))).toBe(true);
    expect(ids.some((id) => id.includes('font-size'))).toBe(true);
    expect(ids.some((id) => id.includes('density'))).toBe(true);
    // search 指令
    expect(ids.some((id) => id.includes('search') || id.includes('message'))).toBe(true);
  });

  it('every feature has label and execute', () => {
    const { result } = renderHook(() => useCommandFeatures());
    for (const f of result.current) {
      expect(f.label).toBeTruthy();
      expect(typeof f.execute).toBe('function');
    }
  });
});
