import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCommandFeatures } from '@/components/workspace/useCommandFeatures';
import { usePreferencesStore } from '@/stores/usePreferencesStore';

describe('useCommandFeatures', () => {
  it('returns feature items containing theme, font-size, density, search', () => {
    const { result } = renderHook(() => useCommandFeatures());
    const ids = result.current.map((f) => f.id);
    expect(ids).toContain('switch-color-theme');
    expect(ids).toContain('font-size');
    expect(ids).toContain('density');
    expect(ids).toContain('search-messages');
  });

  it('every feature has label and execute', () => {
    const { result } = renderHook(() => useCommandFeatures());
    for (const f of result.current) {
      expect(f.label).toBeTruthy();
      expect(typeof f.execute).toBe('function');
    }
  });

  it('font-size execute changes store value', () => {
    const { result } = renderHook(() => useCommandFeatures());
    const fontFeature = result.current.find((f) => f.id === 'font-size');
    expect(fontFeature).toBeDefined();

    const before = usePreferencesStore.getState().fontSize;
    act(() => fontFeature!.execute());
    const after = usePreferencesStore.getState().fontSize;
    expect(after).not.toBe(before);
  });
});
