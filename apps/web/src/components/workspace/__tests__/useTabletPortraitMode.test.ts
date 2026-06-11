import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupMatchMedia } from '@/test/fake-match-media';
import { useTabletPortraitMode } from '../useVisiblePanes';

function matcher(query: string, width: number): boolean {
  if (query === '(max-width: 767px)') return width <= 767;
  if (query === '(min-width: 768px) and (max-width: 1023px)') return width >= 768 && width <= 1023;
  if (query === '(orientation: portrait)') return true;
  return false;
}

function landscapeMatcher(query: string, width: number): boolean {
  if (query === '(max-width: 767px)') return width <= 767;
  if (query === '(min-width: 768px) and (max-width: 1023px)') return width >= 768 && width <= 1023;
  if (query === '(orientation: portrait)') return false;
  return false;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTabletPortraitMode', () => {
  it('tablet 寬 + portrait → true', () => {
    setupMatchMedia(800, matcher);
    const { result } = renderHook(() => useTabletPortraitMode());
    expect(result.current).toBe(true);
  });

  it('tablet 寬 + landscape → false', () => {
    setupMatchMedia(800, landscapeMatcher);
    const { result } = renderHook(() => useTabletPortraitMode());
    expect(result.current).toBe(false);
  });

  it('desktop 寬 + portrait → false', () => {
    setupMatchMedia(1280, matcher);
    const { result } = renderHook(() => useTabletPortraitMode());
    expect(result.current).toBe(false);
  });

  it('mobile 寬 + portrait → false', () => {
    setupMatchMedia(375, matcher);
    const { result } = renderHook(() => useTabletPortraitMode());
    expect(result.current).toBe(false);
  });

  it('desktop → tablet portrait 切換 → 響應變化', () => {
    const mm = setupMatchMedia(1280, matcher);
    const { result } = renderHook(() => useTabletPortraitMode());
    expect(result.current).toBe(false);

    act(() => mm.triggerChange(800));
    expect(result.current).toBe(true);
  });
});
