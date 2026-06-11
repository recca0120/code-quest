import { beforeEach, describe, expect, it } from 'vitest';
import { memoryBackend, readPersistedRaw } from '@/test/memory-persist-storage';
import { usePreferencesStore } from '../usePreferencesStore.ts';

const STORAGE_KEY = 'code-quest:preferences';

describe('usePreferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      colorTheme: 'clay-dark',
      fontSize: 'm',
      density: 'default',
      hiddenItems: [],
    });
  });

  it('has correct default state', () => {
    const state = usePreferencesStore.getState();
    expect(state.colorTheme).toBe('clay-dark');
    expect(state.fontSize).toBe('m');
    expect(state.density).toBe('default');
    expect(state.hiddenItems).toEqual([]);
  });

  it('setColorTheme accepts the system value', () => {
    usePreferencesStore.getState().setColorTheme('auto');
    expect(usePreferencesStore.getState().colorTheme).toBe('auto');
  });

  it('migration from v2 without persisted colorTheme defaults to clay-dark', () => {
    memoryBackend.setItem(STORAGE_KEY, JSON.stringify({ state: { fontSize: 'lg' }, version: 2 }));
    usePreferencesStore.persist.rehydrate();
    expect(usePreferencesStore.getState().colorTheme).toBe('clay-dark');
  });

  it('setColorTheme accepts light and persists', () => {
    usePreferencesStore.getState().setColorTheme('light');
    expect(usePreferencesStore.getState().colorTheme).toBe('light');
    const stored = JSON.parse(readPersistedRaw(STORAGE_KEY) ?? '{}');
    expect(stored.state.colorTheme).toBe('light');
  });

  it('axis setters update individual fields', () => {
    usePreferencesStore.getState().setFontSize('l');
    expect(usePreferencesStore.getState().fontSize).toBe('l');

    usePreferencesStore.getState().setDensity('compact');
    expect(usePreferencesStore.getState().density).toBe('compact');

    usePreferencesStore.getState().setHiddenItems(['foo', 'bar']);
    expect(usePreferencesStore.getState().hiddenItems).toEqual(['foo', 'bar']);
  });

  it('hideItem appends id only once (dedup)', () => {
    const { hideItem } = usePreferencesStore.getState();
    hideItem('banner-x');
    hideItem('banner-x');
    expect(usePreferencesStore.getState().hiddenItems).toEqual(['banner-x']);
  });

  it('showItem removes id from hiddenItems', () => {
    usePreferencesStore.setState({ hiddenItems: ['a', 'b', 'c'] });
    usePreferencesStore.getState().showItem('b');
    expect(usePreferencesStore.getState().hiddenItems).toEqual(['a', 'c']);
  });

  it('clearHiddenItems empties the list', () => {
    usePreferencesStore.setState({ hiddenItems: ['a', 'b'] });
    usePreferencesStore.getState().clearHiddenItems();
    expect(usePreferencesStore.getState().hiddenItems).toEqual([]);
  });

  it('persists axis changes via zustand persist', () => {
    usePreferencesStore.getState().setFontSize('s');
    const stored = JSON.parse(readPersistedRaw(STORAGE_KEY) ?? '{}');
    expect(stored.state.fontSize).toBe('s');
  });

  it('migrates v2 → v3: legacy onboarding/review booleans fold into hiddenItems', () => {
    memoryBackend.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          colorTheme: 'light',
          isOnboardingDismissed: true,
          isReviewUpsellDismissed: true,
        },
        version: 2,
      }),
    );

    usePreferencesStore.persist.rehydrate();

    const state = usePreferencesStore.getState();
    expect(state.colorTheme).toBe('light');
    expect(state.hiddenItems).toContain('onboarding-overlay');
    expect(state.hiddenItems).toContain('banner-review-upsell');
    expect(state.fontSize).toBe('m');
  });

  it('migrates v2 → v3: false booleans do not produce hiddenItems entries', () => {
    memoryBackend.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { isOnboardingDismissed: false, isReviewUpsellDismissed: false },
        version: 2,
      }),
    );

    usePreferencesStore.persist.rehydrate();

    expect(usePreferencesStore.getState().hiddenItems).toEqual([]);
  });

  it('v2 migration preserves existing hiddenItems and deduplicates', () => {
    memoryBackend.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          hiddenItems: ['onboarding-overlay', 'custom-item'],
          isOnboardingDismissed: true,
        },
        version: 2,
      }),
    );

    usePreferencesStore.persist.rehydrate();

    const items = usePreferencesStore.getState().hiddenItems;
    expect(items).toEqual(['onboarding-overlay', 'custom-item']);
  });
});

describe('usePreferencesStore — expandedProjects slice', () => {
  it('starts empty — no project is expanded', () => {
    expect(usePreferencesStore.getState().isExpanded('/any')).toBe(false);
  });

  it('toggle adds then removes', () => {
    const { toggleExpanded, isExpanded } = usePreferencesStore.getState();
    toggleExpanded('/a');
    expect(isExpanded('/a')).toBe(true);
    toggleExpanded('/a');
    expect(isExpanded('/a')).toBe(false);
  });

  it('setExpanded is idempotent', () => {
    const { setExpanded, isExpanded } = usePreferencesStore.getState();
    setExpanded('/a', true);
    setExpanded('/a', true);
    expect(usePreferencesStore.getState().expandedProjects).toEqual(['/a']);
    setExpanded('/a', false);
    setExpanded('/a', false);
    expect(isExpanded('/a')).toBe(false);
  });

  it('persists expandedProjects via zustand persist', () => {
    usePreferencesStore.getState().toggleExpanded('/a');
    const stored = JSON.parse(readPersistedRaw(STORAGE_KEY) ?? '{}');
    expect(stored.state.expandedProjects).toContain('/a');
  });
});

describe('usePreferencesStore — messageVisibility slice', () => {
  it('has null as default (defers to context defaults)', () => {
    expect(usePreferencesStore.getState().enabledTypes).toBeNull();
  });

  it('setEnabledTypes updates the store', () => {
    usePreferencesStore.getState().setEnabledTypes(['text', 'tool_use']);
    expect(usePreferencesStore.getState().enabledTypes).toEqual(['text', 'tool_use']);
  });

  it('persists enabledTypes via zustand persist', () => {
    usePreferencesStore.getState().setEnabledTypes(['text', 'hook_started']);
    const stored = JSON.parse(readPersistedRaw(STORAGE_KEY) ?? '{}');
    expect(stored.state.enabledTypes).toContain('hook_started');
  });
});
