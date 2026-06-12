import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useEffectiveColorTheme } from '../useEffectiveColorTheme.ts';

type MqlStub = MediaQueryList & {
  _listeners: Set<(e: MediaQueryListEvent) => void>;
  _set: (matches: boolean) => void;
};

function createMatchMediaStub(initialDark: boolean): () => MqlStub {
  let currentDark = initialDark;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    get matches() {
      return currentDark;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (type: string, cb: (e: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.add(cb);
    },
    removeEventListener: (type: string, cb: (e: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.delete(cb);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    _listeners: listeners,
    _set: (matches: boolean) => {
      currentDark = matches;
      for (const cb of listeners) {
        cb({ matches, media: '(prefers-color-scheme: dark)' } as MediaQueryListEvent);
      }
    },
    // Test-only helpers (_listeners / _set) — cast to MqlStub so tests can drive the stub
    // matches-value externally; the real MediaQueryList interface has no such hooks.
  } as unknown as MqlStub;
  return () => mql;
}

describe('useEffectiveColorTheme', () => {
  let mqlFactory: () => MqlStub;

  beforeEach(() => {
    mqlFactory = createMatchMediaStub(true);
    vi.stubGlobal('matchMedia', vi.fn(mqlFactory));
    usePreferencesStore.setState({ colorTheme: 'auto' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns clay-dark when preference is clay-dark', () => {
    usePreferencesStore.setState({ colorTheme: 'clay-dark' });
    const { result } = renderHook(() => useEffectiveColorTheme());
    expect(result.current).toBe('clay-dark');
  });

  it('returns light when preference is light', () => {
    usePreferencesStore.setState({ colorTheme: 'light' });
    const { result } = renderHook(() => useEffectiveColorTheme());
    expect(result.current).toBe('light');
  });

  it('returns roast when preference is roast', () => {
    usePreferencesStore.setState({ colorTheme: 'roast' });
    const { result } = renderHook(() => useEffectiveColorTheme());
    expect(result.current).toBe('roast');
  });

  it('returns clay-dark when preference is auto and OS prefers dark', () => {
    mqlFactory = createMatchMediaStub(true);
    vi.stubGlobal('matchMedia', vi.fn(mqlFactory));
    usePreferencesStore.setState({ colorTheme: 'auto' });
    const { result } = renderHook(() => useEffectiveColorTheme());
    expect(result.current).toBe('clay-dark');
  });

  it('returns light when preference is auto and OS prefers light', () => {
    mqlFactory = createMatchMediaStub(false);
    vi.stubGlobal('matchMedia', vi.fn(mqlFactory));
    usePreferencesStore.setState({ colorTheme: 'auto' });
    const { result } = renderHook(() => useEffectiveColorTheme());
    expect(result.current).toBe('light');
  });

  it('re-renders when OS preference changes live', () => {
    const stub = mqlFactory();
    window.matchMedia = vi.fn(() => stub);
    usePreferencesStore.setState({ colorTheme: 'auto' });

    const { result } = renderHook(() => useEffectiveColorTheme());
    expect(result.current).toBe('clay-dark');

    act(() => {
      stub._set(false);
    });

    expect(result.current).toBe('light');
  });
});
