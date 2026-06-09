import { afterEach, describe, expect, it } from 'vitest';
import { createGeneralConfigFeature, generalConfigSignal } from '../general-config-feature.ts';

afterEach(() => {
  generalConfigSignal.setOpen(false, null);
});

describe('generalConfigSignal', () => {
  it('starts closed', () => {
    expect(generalConfigSignal.isOpenFor('__global__')).toBe(false);
  });

  it('can be opened and closed', () => {
    generalConfigSignal.setOpen(true, '__global__');
    expect(generalConfigSignal.isOpenFor('__global__')).toBe(true);
    generalConfigSignal.setOpen(false, null);
    expect(generalConfigSignal.isOpenFor('__global__')).toBe(false);
  });
});

describe('createGeneralConfigFeature', () => {
  it('has id general-config', () => {
    expect(createGeneralConfigFeature().id).toBe('general-config');
  });

  it('is in Settings section with closeSilent', () => {
    const feature = createGeneralConfigFeature();
    expect(feature.label).toBe('General config…');
    expect(feature.section).toBe('Settings');
    expect(feature.ui?.closeSilent).toBe(true);
  });

  it('execute opens generalConfigSignal', () => {
    createGeneralConfigFeature().execute();
    expect(generalConfigSignal.isOpenFor('__global__')).toBe(true);
  });
});
