/**
 * Contract test: persistedLayoutSchema v2 — versioned wire format with
 * channelId rebind, target union, worktrees variant, ratio clamp-not-reject,
 * and v1 → v2 migration.
 */
import { describe, expect, it } from 'vitest';
import { dedupeLayoutChannelIds, migrateLegacyToV2, persistedLayoutSchema } from '../layout.ts';

const V2_LAYOUT = {
  version: 2,
  tabs: [
    {
      id: 'tab-1',
      label: 'main',
      paneRoot: {
        type: 'split',
        id: 's1',
        direction: 'h',
        ratio: 0.6,
        first: {
          type: 'leaf',
          id: 'p1',
          content: { type: 'session', channelId: 'ch-abc', cwd: '/repo/feat' },
        },
        second: {
          type: 'split',
          id: 's2',
          direction: 'v',
          ratio: 0.5,
          first: {
            type: 'leaf',
            id: 'p2',
            content: { type: 'git', target: { kind: 'fixed', cwd: '/repo/feat' } },
          },
          second: { type: 'leaf', id: 'p3', content: { type: 'worktrees' } },
        },
      },
    },
  ],
  activeTabId: 'tab-1',
};

describe('persistedLayoutSchema v2 (contract)', () => {
  it('accepts a full v2 layout (session channelId+cwd, target union, worktrees)', () => {
    const result = persistedLayoutSchema.safeParse(V2_LAYOUT);
    expect(result.success).toBe(true);
  });

  it('accepts openspec content with target union', () => {
    const result = persistedLayoutSchema.safeParse({
      version: 2,
      tabs: [
        {
          id: 't',
          paneRoot: {
            type: 'leaf',
            id: 'p',
            content: { type: 'openspec', target: { kind: 'fixed', cwd: '/repo' } },
          },
        },
      ],
      activeTabId: 't',
    });
    expect(result.success).toBe(true);
  });

  it("accepts reserved target kind 'follow' (worktree-centric D5)", () => {
    const result = persistedLayoutSchema.safeParse({
      version: 2,
      tabs: [
        {
          id: 't',
          paneRoot: { type: 'leaf', id: 'p', content: { type: 'git', target: { kind: 'follow' } } },
        },
      ],
      activeTabId: 't',
    });
    expect(result.success).toBe(true);
  });

  it('accepts session leaf with rail state and preserves it (tmux-workspace-ui P3)', () => {
    const layout = {
      version: 2,
      tabs: [
        {
          id: 't1',
          paneRoot: {
            type: 'leaf',
            id: 'p1',
            content: {
              type: 'session',
              channelId: 'ch-1',
              cwd: '/repo',
              rail: { open: false, tab: 'git' },
            },
          },
        },
      ],
      activeTabId: 't1',
    };
    const parsed = persistedLayoutSchema.parse(layout);
    const leaf = parsed.tabs[0]?.paneRoot;
    if (leaf?.type !== 'leaf' || leaf.content.type !== 'session') throw new Error('shape');
    expect(leaf.content.rail).toEqual({ open: false, tab: 'git' });
  });

  it('session leaf without rail still parses (optional — backward compatible)', () => {
    const parsed = persistedLayoutSchema.parse(V2_LAYOUT);
    const first = parsed.tabs[0]?.paneRoot;
    if (first?.type !== 'split' || first.first.type !== 'leaf') throw new Error('shape');
    expect('rail' in first.first.content ? first.first.content.rail : undefined).toBeUndefined();
  });

  it('rejects a payload without version', () => {
    const { version: _v, ...noVersion } = V2_LAYOUT;
    expect(persistedLayoutSchema.safeParse(noVersion).success).toBe(false);
  });

  it('degrades an unknown content variant to an empty session leaf (13.5)', () => {
    const result = persistedLayoutSchema.safeParse({
      version: 2,
      tabs: [
        {
          id: 't',
          paneRoot: { type: 'leaf', id: 'p', content: { type: 'terminal', cwd: '/x' } },
        },
      ],
      activeTabId: 't',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tabs[0]?.paneRoot).toMatchObject({
        content: { type: 'session', channelId: null, cwd: null },
      });
    }
  });

  it('clamps invalid ratio instead of rejecting the whole layout', () => {
    const bad = structuredClone(V2_LAYOUT) as typeof V2_LAYOUT & {
      tabs: [{ paneRoot: { ratio: unknown } }];
    };
    bad.tabs[0].paneRoot.ratio = Number.NaN;
    const result = persistedLayoutSchema.safeParse(bad);
    expect(result.success).toBe(true);
    if (result.success) {
      const root = result.data.tabs[0]?.paneRoot;
      expect(root?.type).toBe('split');
      if (root?.type === 'split') expect(root.ratio).toBe(0.5);
    }
  });
});

describe('dedupeLayoutChannelIds (11.5/11.6 contract)', () => {
  it('keeps the first occurrence of a channelId, degrades duplicates to empty with cwd hint', () => {
    const layout = persistedLayoutSchema.parse({
      version: 2,
      tabs: [
        {
          id: 't1',
          paneRoot: {
            type: 'split',
            id: 's',
            direction: 'h',
            ratio: 0.5,
            first: {
              type: 'leaf',
              id: 'p1',
              content: { type: 'session', channelId: 'ch-1', cwd: '/a' },
            },
            second: {
              type: 'leaf',
              id: 'p2',
              content: { type: 'session', channelId: 'ch-1', cwd: '/a' },
            },
          },
        },
        {
          // duplicates across workspace tabs are also deduped
          id: 't2',
          paneRoot: {
            type: 'leaf',
            id: 'p3',
            content: { type: 'session', channelId: 'ch-1', cwd: '/a' },
          },
        },
      ],
      activeTabId: 't1',
    });

    const deduped = dedupeLayoutChannelIds(layout);
    const root = deduped.tabs[0]?.paneRoot;
    if (root?.type !== 'split') throw new Error('expected split');
    expect(root.first).toMatchObject({ content: { type: 'session', channelId: 'ch-1' } });
    expect(root.second).toMatchObject({
      content: { type: 'session', channelId: null, cwd: '/a' },
    });
    expect(deduped.tabs[1]?.paneRoot).toMatchObject({
      content: { type: 'session', channelId: null, cwd: '/a' },
    });
  });

  it('returns the same reference when there is nothing to dedupe', () => {
    const layout = persistedLayoutSchema.parse(V2_LAYOUT);
    expect(dedupeLayoutChannelIds(layout)).toBe(layout);
  });
});

describe('migrateLegacyToV2 (contract)', () => {
  const V1_LAYOUT = {
    tabs: [
      {
        id: 'tab-a',
        label: 'A',
        paneRoot: {
          type: 'split',
          id: 's1',
          direction: 'h',
          ratio: 0.5,
          first: { type: 'leaf', id: 'p1', content: { type: 'session', cwd: '/repo' } },
          second: { type: 'leaf', id: 'p2', content: { type: 'git', cwd: '/repo' } },
        },
      },
      {
        id: 'tab-b',
        paneRoot: { type: 'leaf', id: 'p3', content: { type: 'openspec', cwd: '/x' } },
      },
    ],
    activeTabId: 'tab-a',
  };

  it('upgrades v1 (no version) to a valid v2 layout', () => {
    const migrated = migrateLegacyToV2(V1_LAYOUT);
    const result = persistedLayoutSchema.safeParse(migrated);
    expect(result.success).toBe(true);
  });

  it('maps v1 session cwd to { channelId: null, cwd } and tool cwd to fixed target', () => {
    const migrated = migrateLegacyToV2(V1_LAYOUT);
    const result = persistedLayoutSchema.parse(migrated);
    const root = result.tabs[0]?.paneRoot;
    if (root?.type !== 'split') throw new Error('expected split');
    expect(root.first).toMatchObject({
      content: { type: 'session', channelId: null, cwd: '/repo' },
    });
    expect(root.second).toMatchObject({
      content: { type: 'git', target: { kind: 'fixed', cwd: '/repo' } },
    });
    expect(result.tabs[1]?.paneRoot).toMatchObject({
      content: { type: 'openspec', target: { kind: 'fixed', cwd: '/x' } },
    });
  });

  it('passes v2 payloads through unchanged', () => {
    const migrated = migrateLegacyToV2(V2_LAYOUT);
    expect(migrated).toEqual(V2_LAYOUT);
  });

  it('returns null for unrecognizable payloads', () => {
    expect(migrateLegacyToV2({ nonsense: true })).toBeNull();
    expect(migrateLegacyToV2(null)).toBeNull();
  });
});
