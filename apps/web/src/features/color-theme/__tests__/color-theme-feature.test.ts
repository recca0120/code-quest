import { describe, expect, it, vi } from 'vitest';
import { createColorThemeFeature } from '../color-theme-feature.ts';

describe('createColorThemeFeature', () => {
  it('has correct id/section/label/order', () => {
    const feature = createColorThemeFeature({ colorTheme: 'clay-dark', setColorTheme: vi.fn() });
    expect(feature.id).toBe('switch-color-theme');
    expect(feature.section).toBe('Settings');
    expect(feature.label).toBe('Theme');
    expect(feature.order).toBe(10);
  });

  it('state is choice with Dark/Light/Roast/System options', () => {
    const setColorTheme = vi.fn();
    const feature = createColorThemeFeature({ colorTheme: 'clay-dark', setColorTheme });
    expect(feature.state).toMatchObject({
      kind: 'choice',
      options: [
        { value: 'clay-dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
        { value: 'roast', label: 'Roast' },
        { value: 'auto', label: 'System' },
      ],
      currentValue: 'clay-dark',
    });
    if (feature.state?.kind !== 'choice') throw new Error('expected choice');
    feature.state.onSelect('auto');
    expect(setColorTheme).toHaveBeenCalledWith('auto');
  });

  it('currentValue reflects auto preference', () => {
    const feature = createColorThemeFeature({ colorTheme: 'auto', setColorTheme: vi.fn() });
    expect(feature.state).toMatchObject({ kind: 'choice', currentValue: 'auto' });
  });

  it('execute cycles clay-dark -> light', () => {
    const setColorTheme = vi.fn();
    createColorThemeFeature({ colorTheme: 'clay-dark', setColorTheme }).execute();
    expect(setColorTheme).toHaveBeenCalledWith('light');
  });

  it('execute cycles light -> roast', () => {
    const setColorTheme = vi.fn();
    createColorThemeFeature({ colorTheme: 'light', setColorTheme }).execute();
    expect(setColorTheme).toHaveBeenCalledWith('roast');
  });

  it('execute cycles roast -> auto', () => {
    const setColorTheme = vi.fn();
    createColorThemeFeature({ colorTheme: 'roast', setColorTheme }).execute();
    expect(setColorTheme).toHaveBeenCalledWith('auto');
  });

  it('execute wraps auto -> clay-dark', () => {
    const setColorTheme = vi.fn();
    createColorThemeFeature({ colorTheme: 'auto', setColorTheme }).execute();
    expect(setColorTheme).toHaveBeenCalledWith('clay-dark');
  });
});
