import { z } from 'zod';

const colorThemeSchema: z.ZodEnum<{
  'clay-dark': 'clay-dark';
  light: 'light';
  roast: 'roast';
  auto: 'auto';
}> = z.enum(['clay-dark', 'light', 'roast', 'auto']);
export type ColorTheme = z.infer<typeof colorThemeSchema>;

/** Concrete theme after resolving 'auto' via OS preference; used as
 *  DOM data-theme value and by non-CSS consumers (e.g. Prism syntax theme). */
export type EffectiveColorTheme = 'clay-dark' | 'light' | 'roast';

const fontSizeSchema: z.ZodEnum<{ s: 's'; m: 'm'; l: 'l'; xl: 'xl' }> = z.enum([
  's',
  'm',
  'l',
  'xl',
]);
export type FontSize = z.infer<typeof fontSizeSchema>;

const densitySchema: z.ZodEnum<{
  compact: 'compact';
  default: 'default';
  relaxed: 'relaxed';
}> = z.enum(['compact', 'default', 'relaxed']);
export type Density = z.infer<typeof densitySchema>;

export const preferencesStateSchema: z.ZodObject<
  {
    colorTheme: typeof colorThemeSchema;
    fontSize: typeof fontSizeSchema;
    density: typeof densitySchema;
    hiddenItems: z.ZodArray<z.ZodString>;
  },
  z.core.$strip
> = z.object({
  colorTheme: colorThemeSchema,
  fontSize: fontSizeSchema,
  density: densitySchema,
  hiddenItems: z.array(z.string()),
});
export type PreferencesState = z.infer<typeof preferencesStateSchema>;

/** Canonical IDs pushed into `hiddenItems` by dismissible UI. */
export const DISMISSIBLE_IDS = {
  onboardingOverlay: 'onboarding-overlay',
  reviewUpsellBanner: 'banner-review-upsell',
} as const;

// ── localStorage migration（舊值域 → 新值域）──

const THEME_MIGRATION: Record<string, ColorTheme> = {
  dark: 'clay-dark',
  system: 'auto',
};

const FONTSIZE_MIGRATION: Record<string, FontSize> = {
  sm: 's',
  md: 'm',
  lg: 'l',
};

const DENSITY_MIGRATION: Record<string, Density> = {
  comfortable: 'default',
};

/** 把舊 preference 值轉成新值域（hydrate 時呼叫）。新值直通。 */
export function migratePreferences(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw };
  if (typeof result.colorTheme === 'string' && result.colorTheme in THEME_MIGRATION) {
    result.colorTheme = THEME_MIGRATION[result.colorTheme as string];
  }
  if (typeof result.fontSize === 'string' && result.fontSize in FONTSIZE_MIGRATION) {
    result.fontSize = FONTSIZE_MIGRATION[result.fontSize as string];
  }
  if (typeof result.density === 'string' && result.density in DENSITY_MIGRATION) {
    result.density = DENSITY_MIGRATION[result.density as string];
  }
  return result;
}
