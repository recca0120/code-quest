import { useSyncExternalStore } from 'react';
import type { EffectiveColorTheme } from '../stores/preferences-schema.ts';
import { usePreferencesStore } from '../stores/usePreferencesStore.ts';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribePrefersDark(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getPrefersDark(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia(DARK_QUERY).matches;
}

export function useEffectiveColorTheme(): EffectiveColorTheme {
  const preference = usePreferencesStore((s) => s.colorTheme);
  const prefersDark = useSyncExternalStore(subscribePrefersDark, getPrefersDark, () => true);
  if (preference === 'auto') return prefersDark ? 'clay-dark' : 'light';
  return preference;
}
