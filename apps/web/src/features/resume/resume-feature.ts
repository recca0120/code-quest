import type { Feature } from '@/lib/feature';
import { createOpenSignal, type OpenSignal } from '@/lib/open-signal';

export const resumeOpenSignal: OpenSignal = createOpenSignal();

export function createResumeFeature(channelId: string): Feature {
  return {
    id: 'resume',
    label: 'Resume conversation…',
    section: 'Context',
    order: 10,
    execute() {
      resumeOpenSignal.setOpen(true, channelId);
    },
  };
}
