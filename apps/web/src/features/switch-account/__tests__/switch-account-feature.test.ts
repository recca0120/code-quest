import { describe, expect, it } from 'vitest';
import { createSwitchAccountFeature, switchAccountSignal } from '../switch-account-feature.ts';

describe('switchAccountSignal', () => {
  it('starts closed', () => {
    expect(switchAccountSignal.isOpenFor('__global__')).toBe(false);
  });

  it('can be opened and closed', () => {
    switchAccountSignal.setOpen(true, '__global__');
    expect(switchAccountSignal.isOpenFor('__global__')).toBe(true);
    switchAccountSignal.setOpen(false, null);
    expect(switchAccountSignal.isOpenFor('__global__')).toBe(false);
  });
});

describe('createSwitchAccountFeature', () => {
  it('has id switch-account', () => {
    expect(createSwitchAccountFeature().id).toBe('switch-account');
  });

  it('is in Settings section with closeSilent', () => {
    const feature = createSwitchAccountFeature();
    expect(feature.label).toBe('Switch account');
    expect(feature.section).toBe('Settings');
    expect(feature.ui?.closeSilent).toBe(true);
  });

  it('execute opens switchAccountSignal', () => {
    switchAccountSignal.setOpen(false, null);
    createSwitchAccountFeature().execute();
    expect(switchAccountSignal.isOpenFor('__global__')).toBe(true);
    switchAccountSignal.setOpen(false, null);
  });
});
