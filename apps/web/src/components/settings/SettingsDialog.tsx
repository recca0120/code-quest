import { useMemo, useState } from 'react';
import { defaultEnabledTypes } from '@/contexts/channel/MessageVisibilityContext';
import { createColorThemeFeature } from '@/features/color-theme/color-theme-feature';
import { createDensityFeature } from '@/features/density/density-feature';
import { createFilterFeatures } from '@/features/filters/create-filter-features';
import { createFontSizeFeature } from '@/features/font-size/font-size-feature';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { cn } from '@/utils/cn';
import { FeatureRow } from '../palette/FeatureRow.tsx';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogClose, DialogContent } from '../ui/Dialog.tsx';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = ['Theme', 'Display'] as const;
const EMPTY_SET = new Set<string>();
const EMPTY_MAP = new Map<string, unknown>();
type Section = (typeof SECTIONS)[number];

export function SettingsDialog({ open, onClose }: SettingsDialogProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<Section>('Theme');

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent title="Settings" hideTitle className="w-140 max-w-[calc(100vw-32px)] p-0">
        <div className="flex h-[min(70vh,520px)]">
          <nav
            aria-label="Settings sections"
            className="flex flex-col w-36 shrink-0 border-r border-border py-2"
          >
            {SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                role="tab"
                aria-selected={activeSection === section}
                onClick={() => setActiveSection(section)}
                className={cn(
                  'px-4 py-2 text-left text-xs font-mono cursor-pointer transition-colors',
                  activeSection === section
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-subtle hover:text-text hover:bg-hover-tint',
                )}
              >
                {section}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs text-muted mb-4">
              Changes apply instantly and are saved automatically.
            </p>
            {activeSection === 'Theme' && <ThemeSection />}
            {activeSection === 'Display' && <DisplaySection />}
          </div>
        </div>

        <div className="flex justify-end px-4 py-3 border-t border-border">
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ThemeSection() {
  const colorTheme = usePreferencesStore((s) => s.colorTheme);
  const fontSize = usePreferencesStore((s) => s.fontSize);
  const density = usePreferencesStore((s) => s.density);
  const setColorTheme = usePreferencesStore((s) => s.setColorTheme);
  const setFontSize = usePreferencesStore((s) => s.setFontSize);
  const setDensity = usePreferencesStore((s) => s.setDensity);

  const features = useMemo(
    () => [
      createColorThemeFeature({ colorTheme, setColorTheme }),
      createFontSizeFeature({ fontSize, setFontSize }),
      createDensityFeature({ density, setDensity }),
    ],
    [colorTheme, fontSize, density, setColorTheme, setFontSize, setDensity],
  );

  return (
    <div className="flex flex-col">
      {features.map((feature) => (
        <FeatureRow key={feature.id} feature={feature} isActive={false} />
      ))}
    </div>
  );
}

function DisplaySection() {
  const visibilityTypes = usePreferencesStore((s) => s.enabledTypes);
  const setStoreEnabledTypes = usePreferencesStore((s) => s.setEnabledTypes);

  const enabledTypes = useMemo(
    () => (visibilityTypes !== null ? new Set(visibilityTypes) : defaultEnabledTypes()),
    [visibilityTypes],
  );

  const toggleType = useMemo(
    () => (type: string) => {
      const current = usePreferencesStore.getState().enabledTypes;
      const base = current !== null ? new Set(current) : defaultEnabledTypes();
      if (base.has(type)) base.delete(type);
      else base.add(type);
      setStoreEnabledTypes([...base]);
    },
    [setStoreEnabledTypes],
  );

  const features = useMemo(
    () =>
      createFilterFeatures({
        enabledTypes,
        unknownTypes: EMPTY_SET,
        toggleType,
        latestByType: EMPTY_MAP as Map<string, never>,
      }),
    [enabledTypes, toggleType],
  );

  return (
    <div className="flex flex-col">
      {features.map((feature) => (
        <FeatureRow key={feature.id} feature={feature} isActive={false} />
      ))}
    </div>
  );
}
