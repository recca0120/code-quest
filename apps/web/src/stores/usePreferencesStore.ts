import { create, type Mutate, type StoreApi, type UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { localStoragePersist } from './persistStorage.ts';
import {
  type ColorTheme,
  type Density,
  DISMISSIBLE_IDS,
  type FontSize,
  migratePreferences,
  type PreferencesState as PersistedPreferences,
  preferencesStateSchema,
} from './preferences-schema.ts';

export type { ColorTheme, Density, FontSize };

interface PreferencesState extends PersistedPreferences {
  setColorTheme: (v: ColorTheme) => void;
  setFontSize: (v: FontSize) => void;
  setDensity: (v: Density) => void;
  setHiddenItems: (v: string[]) => void;
  hideItem: (id: string) => void;
  showItem: (id: string) => void;
  clearHiddenItems: () => void;

  expandedProjects: string[];
  isExpanded: (cwd: string) => boolean;
  toggleExpanded: (cwd: string) => void;
  setExpanded: (cwd: string, expanded: boolean) => void;

  enabledTypes: string[] | null;
  setEnabledTypes: (types: string[]) => void;
}

const DEFAULTS: PersistedPreferences & {
  expandedProjects: string[];
  enabledTypes: string[] | null;
} = {
  colorTheme: 'clay-dark',
  fontSize: 'm',
  density: 'default',
  hiddenItems: [],
  expandedProjects: [],
  enabledTypes: null,
};

const persistedPreferencesSchema = preferencesStateSchema.partial();

interface V2Shape {
  colorTheme?: string;
  fontSize?: string;
  density?: string;
  hiddenItems?: string[];
  isOnboardingDismissed?: boolean;
  isReviewUpsellDismissed?: boolean;
}

function migrateV2ToV3(persisted: V2Shape): Record<string, unknown> {
  const hidden = new Set(persisted.hiddenItems ?? []);
  if (persisted.isOnboardingDismissed) hidden.add(DISMISSIBLE_IDS.onboardingOverlay);
  if (persisted.isReviewUpsellDismissed) hidden.add(DISMISSIBLE_IDS.reviewUpsellBanner);
  const { isOnboardingDismissed, isReviewUpsellDismissed, ...rest } = persisted;
  void isOnboardingDismissed;
  void isReviewUpsellDismissed;
  return { ...rest, hiddenItems: [...hidden] };
}

export const usePreferencesStore: UseBoundStore<
  Mutate<StoreApi<PreferencesState>, [['zustand/persist', unknown]]>
> = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setDensity: (density) => set({ density }),
      setHiddenItems: (hiddenItems) => set({ hiddenItems }),
      hideItem: (id) =>
        set((s) => (s.hiddenItems.includes(id) ? s : { hiddenItems: [...s.hiddenItems, id] })),
      showItem: (id) => set((s) => ({ hiddenItems: s.hiddenItems.filter((i) => i !== id) })),
      clearHiddenItems: () => set({ hiddenItems: [] }),

      isExpanded: (cwd) => get().expandedProjects.includes(cwd),
      toggleExpanded: (cwd) =>
        set((s) => ({
          expandedProjects: s.expandedProjects.includes(cwd)
            ? s.expandedProjects.filter((x) => x !== cwd)
            : [...s.expandedProjects, cwd],
        })),
      setExpanded: (cwd, expanded) =>
        set((s) => {
          const has = s.expandedProjects.includes(cwd);
          if (expanded === has) return s;
          return {
            expandedProjects: expanded
              ? [...s.expandedProjects, cwd]
              : s.expandedProjects.filter((x) => x !== cwd),
          };
        }),

      setEnabledTypes: (types) => set({ enabledTypes: types }),
    }),
    {
      name: 'code-quest:preferences',
      storage: localStoragePersist(),
      version: 5,
      partialize: ({
        colorTheme,
        fontSize,
        density,
        hiddenItems,
        expandedProjects,
        enabledTypes,
      }) => ({
        colorTheme,
        fontSize,
        density,
        hiddenItems,
        expandedProjects,
        enabledTypes,
      }),
      migrate: (persisted: unknown, fromVersion: number) => {
        const v2 =
          fromVersion < 3
            ? migrateV2ToV3((persisted ?? {}) as V2Shape)
            : ((persisted as Record<string, unknown>) ?? {});
        // v4→v5：舊值域遷移（dark→clay-dark, sm→s, comfortable→default 等）
        const v5 = fromVersion < 5 ? migratePreferences(v2) : v2;
        const parsed = persistedPreferencesSchema.safeParse(v5);
        const prev = parsed.success ? parsed.data : {};
        return { ...DEFAULTS, ...prev } as PreferencesState;
      },
    },
  ),
);
