import { describe, expect, it } from 'vitest';
import {
  type ColorTheme,
  type Density,
  type FontSize,
  migratePreferences,
  preferencesStateSchema,
} from '../preferences-schema.ts';

describe('preferencesStateSchema', () => {
  it('accepts new value domain (clay-dark / s / default)', () => {
    const parsed = preferencesStateSchema.safeParse({
      colorTheme: 'clay-dark',
      fontSize: 's',
      density: 'default',
      hiddenItems: [],
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts all ColorTheme values: clay-dark | light | roast | auto', () => {
    for (const theme of ['clay-dark', 'light', 'roast', 'auto'] satisfies ColorTheme[]) {
      expect(preferencesStateSchema.partial().safeParse({ colorTheme: theme }).success).toBe(true);
    }
  });

  it('accepts all FontSize values: s | m | l | xl', () => {
    for (const size of ['s', 'm', 'l', 'xl'] satisfies FontSize[]) {
      expect(preferencesStateSchema.partial().safeParse({ fontSize: size }).success).toBe(true);
    }
  });

  it('accepts all Density values: compact | default | relaxed', () => {
    for (const d of ['compact', 'default', 'relaxed'] satisfies Density[]) {
      expect(preferencesStateSchema.partial().safeParse({ density: d }).success).toBe(true);
    }
  });

  it('rejects old values (dark, system, sm, md, lg, comfortable)', () => {
    expect(preferencesStateSchema.partial().safeParse({ colorTheme: 'dark' }).success).toBe(false);
    expect(preferencesStateSchema.partial().safeParse({ colorTheme: 'system' }).success).toBe(
      false,
    );
    expect(preferencesStateSchema.partial().safeParse({ fontSize: 'sm' }).success).toBe(false);
    expect(preferencesStateSchema.partial().safeParse({ fontSize: 'md' }).success).toBe(false);
    expect(preferencesStateSchema.partial().safeParse({ fontSize: 'lg' }).success).toBe(false);
    expect(preferencesStateSchema.partial().safeParse({ density: 'comfortable' }).success).toBe(
      false,
    );
  });

  it('rejects unknown enum values', () => {
    expect(
      preferencesStateSchema.safeParse({
        colorTheme: 'sepia',
        fontSize: 'm',
        density: 'default',
        hiddenItems: [],
      }).success,
    ).toBe(false);
  });

  it('partial() accepts missing fields (for persisted migration)', () => {
    const parsed = preferencesStateSchema.partial().safeParse({ colorTheme: 'light' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ colorTheme: 'light' });
  });
});

describe('migratePreferences', () => {
  it('dark → clay-dark', () => {
    expect(migratePreferences({ colorTheme: 'dark' } as never).colorTheme).toBe('clay-dark');
  });

  it('system → auto', () => {
    expect(migratePreferences({ colorTheme: 'system' } as never).colorTheme).toBe('auto');
  });

  it('sm → s, md → m, lg → l', () => {
    expect(migratePreferences({ fontSize: 'sm' } as never).fontSize).toBe('s');
    expect(migratePreferences({ fontSize: 'md' } as never).fontSize).toBe('m');
    expect(migratePreferences({ fontSize: 'lg' } as never).fontSize).toBe('l');
  });

  it('comfortable → default', () => {
    expect(migratePreferences({ density: 'comfortable' } as never).density).toBe('default');
  });

  it('new values pass through unchanged', () => {
    const input = { colorTheme: 'roast', fontSize: 'xl', density: 'relaxed' };
    const result = migratePreferences(input as never);
    expect(result).toEqual(input);
  });
});
