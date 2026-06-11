import { createChoiceFeature } from '@/lib/create-choice-feature';
import type { Feature } from '@/lib/feature';
import type { FontSize } from '@/stores/usePreferencesStore';

interface FontSizeFeatureDeps {
  fontSize: FontSize;
  setFontSize: (v: FontSize) => void;
}

export function createFontSizeFeature({ fontSize, setFontSize }: FontSizeFeatureDeps): Feature {
  return createChoiceFeature<FontSize>({
    id: 'font-size',
    label: 'Font size',
    section: 'Settings',
    order: 12,
    tabs: ['actions'],
    options: [
      { value: 's', label: 'Small' },
      { value: 'm', label: 'Medium' },
      { value: 'l', label: 'Large' },
      { value: 'xl', label: 'Extra Large' },
    ],
    currentValue: fontSize,
    onSelect: setFontSize,
  });
}
