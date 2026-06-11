import { createChoiceFeature } from '@/lib/create-choice-feature';
import type { Feature } from '@/lib/feature';
import type { ColorTheme } from '@/stores/usePreferencesStore';

interface ColorThemeFeatureDeps {
  colorTheme: ColorTheme;
  setColorTheme: (v: ColorTheme) => void;
}

export function createColorThemeFeature({
  colorTheme,
  setColorTheme,
}: ColorThemeFeatureDeps): Feature {
  return createChoiceFeature<ColorTheme>({
    id: 'switch-color-theme',
    label: 'Theme',
    section: 'Settings',
    order: 10,
    tabs: ['actions'],
    options: [
      { value: 'clay-dark', label: 'Dark' },
      { value: 'light', label: 'Light' },
      { value: 'roast', label: 'Roast' },
      { value: 'auto', label: 'System' },
    ],
    currentValue: colorTheme,
    onSelect: setColorTheme,
  });
}
