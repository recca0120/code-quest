import { describe, expect, it, vi } from 'vitest';
import { createFontSizeFeature } from '../font-size-feature.ts';

describe('createFontSizeFeature', () => {
  it('has correct id/section/label', () => {
    const feature = createFontSizeFeature({ fontSize: 'm', setFontSize: vi.fn() });
    expect(feature.id).toBe('font-size');
    expect(feature.section).toBe('Settings');
    expect(feature.label).toBe('Font size');
  });

  it('state is choice with Small/Medium/Large/Extra Large options', () => {
    const setFontSize = vi.fn();
    const feature = createFontSizeFeature({ fontSize: 'm', setFontSize });
    expect(feature.state).toMatchObject({
      kind: 'choice',
      options: [
        { value: 's', label: 'Small' },
        { value: 'm', label: 'Medium' },
        { value: 'l', label: 'Large' },
        { value: 'xl', label: 'Extra Large' },
      ],
      currentValue: 'm',
    });
    if (feature.state?.kind !== 'choice') throw new Error('expected choice');
    feature.state.onSelect('l');
    expect(setFontSize).toHaveBeenCalledWith('l');
  });

  it('execute cycles s -> m -> l -> xl -> s', () => {
    const setFontSize = vi.fn();
    createFontSizeFeature({ fontSize: 's', setFontSize }).execute();
    expect(setFontSize).toHaveBeenLastCalledWith('m');

    setFontSize.mockClear();
    createFontSizeFeature({ fontSize: 'm', setFontSize }).execute();
    expect(setFontSize).toHaveBeenLastCalledWith('l');

    setFontSize.mockClear();
    createFontSizeFeature({ fontSize: 'l', setFontSize }).execute();
    expect(setFontSize).toHaveBeenLastCalledWith('xl');

    setFontSize.mockClear();
    createFontSizeFeature({ fontSize: 'xl', setFontSize }).execute();
    expect(setFontSize).toHaveBeenLastCalledWith('s');
  });

  it('ui.closeSilent is true (picking a pill keeps Cmd+K open)', () => {
    const feature = createFontSizeFeature({ fontSize: 'm', setFontSize: vi.fn() });
    expect(feature.ui?.closeSilent).toBe(true);
  });
});
