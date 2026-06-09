import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModelFeature, modelOpenSignal } from '../model-feature.ts';

afterEach(() => {
  modelOpenSignal.setOpen(false, null);
});

describe('createModelFeature', () => {
  it('has id model', () => {
    const feature = createModelFeature({ modelLabel: 'Opus', channelId: 'ch-test' });
    expect(feature.id).toBe('model');
  });

  it('is in Model section with label Switch model', () => {
    const feature = createModelFeature({ modelLabel: 'Opus', channelId: 'ch-test' });
    expect(feature.label).toBe('Switch model');
    expect(feature.section).toBe('Model');
  });

  it('state is select with currentValue reflecting modelLabel', () => {
    const feature = createModelFeature({ modelLabel: 'Opus 4', channelId: 'ch-test' });
    expect(feature.state).toEqual({ kind: 'select', currentValue: 'Opus 4' });
  });

  it('opens model dialog without closing the menu (closeSilent: true)', () => {
    const feature = createModelFeature({ modelLabel: 'Opus', channelId: 'ch-test' });
    expect(feature.ui?.closeSilent).toBe(true);
  });

  it('execute sets signal open for the given channelId', () => {
    const feature = createModelFeature({ modelLabel: 'Opus', channelId: 'ch-test' });
    expect(modelOpenSignal.isOpenFor('ch-test')).toBe(false);
    feature.execute();
    expect(modelOpenSignal.isOpenFor('ch-test')).toBe(true);
  });

  it('execute does not open for other channelIds', () => {
    const feature = createModelFeature({ modelLabel: 'Opus', channelId: 'ch-test' });
    feature.execute();
    expect(modelOpenSignal.isOpenFor('ch-other')).toBe(false);
  });

  it('signal notifies subscriber on open', () => {
    const cb = vi.fn();
    const unsub = modelOpenSignal.subscribe(cb);
    createModelFeature({ modelLabel: 'Opus', channelId: 'ch-test' }).execute();
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('setOpen(false, null) closes signal', () => {
    modelOpenSignal.setOpen(true, 'ch-test');
    modelOpenSignal.setOpen(false, null);
    expect(modelOpenSignal.isOpenFor('ch-test')).toBe(false);
  });

  it('setOpen with same value does not notify', () => {
    const cb = vi.fn();
    const unsub = modelOpenSignal.subscribe(cb);
    modelOpenSignal.setOpen(false, null); // already null
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });
});
