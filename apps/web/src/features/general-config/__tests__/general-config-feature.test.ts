import { afterEach, describe, expect, it } from 'vitest';
import { createGeneralConfigFeature, generalConfigSignal } from '../general-config-feature.ts';

afterEach(() => {
  generalConfigSignal.setOpen(false);
});

describe('generalConfigSignal', () => {
  it('starts closed', () => {
    expect(generalConfigSignal.isOpen).toBe(false);
  });

  it('can be opened and closed', () => {
    generalConfigSignal.setOpen(true);
    expect(generalConfigSignal.isOpen).toBe(true);
    generalConfigSignal.setOpen(false);
    expect(generalConfigSignal.isOpen).toBe(false);
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
    expect(generalConfigSignal.isOpen).toBe(true);
  });
});
