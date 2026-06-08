/**
 * Contract test: sessionLaunchPayloadSchema and sessionStateSummarySchema
 * must support optional branch field for pane header display.
 */
import { describe, expect, it } from 'vitest';
import { sessionLaunchPayloadSchema, sessionStateSummarySchema } from '../session.ts';

describe('sessionLaunchPayloadSchema branch (contract)', () => {
  it('accepts launch payload with branch', () => {
    const result = sessionLaunchPayloadSchema.safeParse({
      cwd: '/repo',
      branch: 'feat/my-feature',
      launchOptions: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.branch).toBe('feat/my-feature');
    }
  });

  it('accepts launch payload without branch (backward compatible)', () => {
    const result = sessionLaunchPayloadSchema.safeParse({
      cwd: '/repo',
      launchOptions: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.branch).toBeUndefined();
    }
  });
});

describe('sessionStateSummarySchema branch (contract)', () => {
  it('accepts state summary with branch', () => {
    const result = sessionStateSummarySchema.safeParse({
      channelId: 'ch-1',
      state: 'idle',
      projectRoot: '/repo',
      branch: 'main',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.branch).toBe('main');
    }
  });

  it('accepts state summary without branch (backward compatible)', () => {
    const result = sessionStateSummarySchema.safeParse({
      channelId: 'ch-1',
      state: 'idle',
      projectRoot: '/repo',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.branch).toBeUndefined();
    }
  });
});
