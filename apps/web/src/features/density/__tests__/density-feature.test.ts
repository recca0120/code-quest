import { describe, expect, it, vi } from 'vitest';
import { createDensityFeature } from '../density-feature.ts';

describe('createDensityFeature', () => {
  it('has correct id/section/label/order', () => {
    const feature = createDensityFeature({ density: 'default', setDensity: vi.fn() });
    expect(feature.id).toBe('density');
    expect(feature.section).toBe('Settings');
    expect(feature.label).toBe('Density');
    expect(feature.order).toBe(11);
  });

  it('state is choice with Compact/Default/Relaxed options', () => {
    const setDensity = vi.fn();
    const feature = createDensityFeature({ density: 'compact', setDensity });
    expect(feature.state).toMatchObject({
      kind: 'choice',
      options: [
        { value: 'compact', label: 'Compact' },
        { value: 'default', label: 'Default' },
        { value: 'relaxed', label: 'Relaxed' },
      ],
      currentValue: 'compact',
    });
    if (feature.state?.kind !== 'choice') throw new Error('expected choice');
    feature.state.onSelect('default');
    expect(setDensity).toHaveBeenCalledWith('default');
  });

  it('execute cycles compact -> default', () => {
    const setDensity = vi.fn();
    createDensityFeature({ density: 'compact', setDensity }).execute();
    expect(setDensity).toHaveBeenCalledWith('default');
  });

  it('execute cycles default -> relaxed', () => {
    const setDensity = vi.fn();
    createDensityFeature({ density: 'default', setDensity }).execute();
    expect(setDensity).toHaveBeenCalledWith('relaxed');
  });

  it('execute wraps relaxed -> compact', () => {
    const setDensity = vi.fn();
    createDensityFeature({ density: 'relaxed', setDensity }).execute();
    expect(setDensity).toHaveBeenCalledWith('compact');
  });
});
