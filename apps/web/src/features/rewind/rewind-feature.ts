import type { Feature } from '@/lib/feature';
import { createOpenSignal, type OpenSignal } from '@/lib/open-signal';

export const rewindOpenSignal: OpenSignal = createOpenSignal();

export function createRewindFeature(channelId: string): Feature {
  return {
    id: 'rewind',
    label: 'Rewind',
    section: 'Context',
    order: 1,
    execute() {
      rewindOpenSignal.setOpen(true, channelId);
    },
  };
}
