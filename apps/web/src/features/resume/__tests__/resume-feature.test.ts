import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResumeFeature, resumeOpenSignal } from '../resume-feature.ts';

afterEach(() => {
  resumeOpenSignal.setOpen(false, null);
});

describe('createResumeFeature', () => {
  it('has id resume', () => {
    const feature = createResumeFeature('ch-test');
    expect(feature.id).toBe('resume');
  });

  it('is in Context section with label Resume conversation…', () => {
    const feature = createResumeFeature('ch-test');
    expect(feature.label).toBe('Resume conversation…');
    expect(feature.section).toBe('Context');
    expect(feature.order).toBe(10);
  });

  it('execute sets signal open for the given channelId', () => {
    const feature = createResumeFeature('ch-test');
    expect(resumeOpenSignal.isOpenFor('ch-test')).toBe(false);
    feature.execute();
    expect(resumeOpenSignal.isOpenFor('ch-test')).toBe(true);
  });

  it('execute does not open for other channelIds', () => {
    const feature = createResumeFeature('ch-test');
    feature.execute();
    expect(resumeOpenSignal.isOpenFor('ch-other')).toBe(false);
  });

  it('signal notifies subscriber on open', () => {
    const cb = vi.fn();
    const unsub = resumeOpenSignal.subscribe(cb);
    createResumeFeature('ch-test').execute();
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('setOpen(false, null) closes signal', () => {
    resumeOpenSignal.setOpen(true, 'ch-test');
    resumeOpenSignal.setOpen(false, null);
    expect(resumeOpenSignal.isOpenFor('ch-test')).toBe(false);
  });

  it('setOpen with same value does not notify', () => {
    const cb = vi.fn();
    const unsub = resumeOpenSignal.subscribe(cb);
    resumeOpenSignal.setOpen(false, null); // already null
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });
});
