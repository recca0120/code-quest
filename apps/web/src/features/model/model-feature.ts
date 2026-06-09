import type { Feature } from '@/lib/feature';
import { createOpenSignal, type OpenSignal } from '@/lib/open-signal';

export const modelOpenSignal: OpenSignal = createOpenSignal();

interface ModelFeatureDeps {
  modelLabel: string;
  channelId: string;
}

export function createModelFeature({ modelLabel, channelId }: ModelFeatureDeps): Feature {
  return {
    id: 'model',
    label: 'Switch model',
    section: 'Model',
    order: 0,
    state: { kind: 'select', currentValue: modelLabel },
    ui: { closeSilent: true },
    execute() {
      modelOpenSignal.setOpen(true, channelId);
    },
  };
}
