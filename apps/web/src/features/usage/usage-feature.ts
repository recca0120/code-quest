import type { Feature } from '@/lib/feature';
import { createOpenSignal, type OpenSignal } from '@/lib/open-signal';

export const usageOpenSignal: OpenSignal = createOpenSignal();

interface UsageFeatureDeps {
  emitRefreshUsage: () => void;
  channelId: string;
}

export function createUsageFeature({ emitRefreshUsage, channelId }: UsageFeatureDeps): Feature {
  function run() {
    emitRefreshUsage();
    usageOpenSignal.setOpen(true, channelId);
  }
  return {
    id: 'usage',
    label: 'Account & usage…',
    section: 'Model',
    order: 40,
    ui: { closeSilent: true },
    execute: run,
    slash: {
      command: '/usage',
      invoke() {
        run();
      },
    },
  };
}
