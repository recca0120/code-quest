import { useMemo } from 'react';
import { createColorThemeFeature } from '@/features/color-theme/color-theme-feature';
import { createDensityFeature } from '@/features/density/density-feature';
import { createFontSizeFeature } from '@/features/font-size/font-size-feature';
import type { Feature } from '@/lib/feature';
import { usePreferencesStore } from '@/stores/usePreferencesStore';

/**
 * 指令模式 feature items（unified-command-entry §2）——從 CommandPalette 抽出的
 * 純 feature 收集邏輯。PanePicker 指令模式與未來共用 shell 都消費這個 hook。
 */
export function useCommandFeatures(): Feature[] {
  const colorTheme = usePreferencesStore((s) => s.colorTheme);
  const setColorTheme = usePreferencesStore((s) => s.setColorTheme);
  const fontSize = usePreferencesStore((s) => s.fontSize);
  const setFontSize = usePreferencesStore((s) => s.setFontSize);
  const density = usePreferencesStore((s) => s.density);
  const setDensity = usePreferencesStore((s) => s.setDensity);

  return useMemo<Feature[]>(
    () => [
      createColorThemeFeature({ colorTheme, setColorTheme }),
      createFontSizeFeature({ fontSize, setFontSize }),
      createDensityFeature({ density, setDensity }),
      // search 指令（placeholder——完整訊息搜尋在 3.3/3.4 實作）
      {
        id: 'search-messages',
        label: '搜尋對話訊息',
        section: 'Context',
        execute: () => {
          // TODO: 3.3/3.4 接入 CommandPalette Messages tab
        },
      },
    ],
    [colorTheme, setColorTheme, fontSize, setFontSize, density, setDensity],
  );
}
