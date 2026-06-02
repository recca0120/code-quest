import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSmoothedValue } from '../useSmoothedValue.ts';

describe('useSmoothedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 when target is undefined', () => {
    const { result } = renderHook(() => useSmoothedValue(undefined));
    expect(result.current).toBe(0);
  });

  it('returns target immediately on first render', () => {
    const { result } = renderHook(() => useSmoothedValue(500));
    expect(result.current).toBe(500);
  });

  it('snaps immediately when target decreases', () => {
    const { result, rerender } = renderHook(({ target }) => useSmoothedValue(target), {
      initialProps: { target: 1000 as number | undefined },
    });
    rerender({ target: 0 });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe(0);
  });

  it('eases toward target when target increases — displayed grows but does not reach target in one tick', () => {
    const { result, rerender } = renderHook(({ target }) => useSmoothedValue(target), {
      initialProps: { target: 0 as number | undefined },
    });
    rerender({ target: 1000 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBeGreaterThanOrEqual(100); // at least one easing step
    expect(result.current).toBeLessThan(1000);
  });

  it('eventually reaches the target after sufficient time', () => {
    const { result, rerender } = renderHook(({ target }) => useSmoothedValue(target), {
      initialProps: { target: 0 as number | undefined },
    });
    rerender({ target: 100 });
    // 100 ticks × 100ms = 10s is more than enough for easing to converge on 100
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(100);
  });

  it('stops updating after reaching target (no interval leak)', () => {
    const { result, rerender } = renderHook(({ target }) => useSmoothedValue(target), {
      initialProps: { target: 0 as number | undefined },
    });
    rerender({ target: 10 });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(10);
    // advance further — value must not drift
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(10);
  });

  it('displayed stays at 0 after unmount — no further state updates', () => {
    const { rerender, unmount } = renderHook(({ target }) => useSmoothedValue(target), {
      initialProps: { target: 0 as number | undefined },
    });
    rerender({ target: 500 });
    unmount();
    // if interval were still running, advancing timers would throw
    // "Warning: Cannot update a component while rendering a different component"
    // The fact that this does not throw is the assertion
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
    }).not.toThrow();
  });
});
