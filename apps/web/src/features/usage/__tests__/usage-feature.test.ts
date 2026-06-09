import { describe, expect, it, vi } from 'vitest';
import { createUsageFeature, usageOpenSignal } from '../usage-feature.ts';

describe('createUsageFeature', () => {
  it('has id usage, /usage slash binding, and Account menu fields', () => {
    const feature = createUsageFeature({ emitRefreshUsage: vi.fn(), channelId: 'ch-test' });
    expect(feature.id).toBe('usage');
    expect(feature.slash?.command).toBe('/usage');
    expect(feature.label).toBe('Account & usage…');
    expect(feature.section).toBe('Model');
    expect(feature.order).toBe(40);
    expect(feature.ui?.closeSilent).toBe(true);
  });

  it('execute emits refresh and opens dialog for the given channelId', () => {
    usageOpenSignal.setOpen(false, null);
    const emitRefreshUsage = vi.fn();
    createUsageFeature({ emitRefreshUsage, channelId: 'ch-test' }).execute();
    expect(emitRefreshUsage).toHaveBeenCalledOnce();
    expect(usageOpenSignal.isOpenFor('ch-test')).toBe(true);
    usageOpenSignal.setOpen(false, null);
  });

  it('execute does not open for other channelIds', () => {
    usageOpenSignal.setOpen(false, null);
    createUsageFeature({ emitRefreshUsage: vi.fn(), channelId: 'ch-test' }).execute();
    expect(usageOpenSignal.isOpenFor('ch-other')).toBe(false);
    usageOpenSignal.setOpen(false, null);
  });

  it('invoke delegates to execute', () => {
    usageOpenSignal.setOpen(false, null);
    const emitRefreshUsage = vi.fn();
    const feature = createUsageFeature({ emitRefreshUsage, channelId: 'ch-test' });
    feature.slash?.invoke('/usage');
    expect(emitRefreshUsage).toHaveBeenCalledOnce();
    expect(usageOpenSignal.isOpenFor('ch-test')).toBe(true);
    usageOpenSignal.setOpen(false, null);
  });
});
