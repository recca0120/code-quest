import type { Feature } from '@/lib/feature';
import { createOpenSignal, type OpenSignal } from '@/lib/open-signal';

export const generalConfigSignal: OpenSignal = createOpenSignal();

export function createGeneralConfigFeature(): Feature {
  return {
    id: 'general-config',
    label: 'General config…',
    section: 'Settings',
    ui: { closeSilent: true },
    execute() {
      generalConfigSignal.setOpen(true, '__global__');
    },
  };
}
