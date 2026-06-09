import { describe, expect, it } from 'vitest';
import { createRewindFeature, rewindOpenSignal } from '../rewind-feature.ts';

describe('createRewindFeature', () => {
  it('has id rewind with label in Context section', () => {
    const feature = createRewindFeature('ch-test');
    expect(feature.id).toBe('rewind');
    expect(feature.label).toBe('Rewind');
    expect(feature.section).toBe('Context');
    expect(feature.order).toBe(1);
  });

  it('execute opens the rewind dialog via signal for the given channelId', () => {
    rewindOpenSignal.setOpen(false, null);
    createRewindFeature('ch-test').execute();
    expect(rewindOpenSignal.isOpenFor('ch-test')).toBe(true);
    rewindOpenSignal.setOpen(false, null);
  });

  it('execute does not open for other channelIds', () => {
    rewindOpenSignal.setOpen(false, null);
    createRewindFeature('ch-test').execute();
    expect(rewindOpenSignal.isOpenFor('ch-other')).toBe(false);
    rewindOpenSignal.setOpen(false, null);
  });
});
