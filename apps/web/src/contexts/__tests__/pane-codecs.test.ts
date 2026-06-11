import { describe, expect, it } from 'vitest';
import { deserializeNode, serializeLayout, serializeNode } from '@/contexts/pane-codecs';
import type { PaneContent, PaneNode } from '@/contexts/TabContext';

// ── deterministic seeded PRNG（mulberry32）──
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRatio(rng: () => number): number {
  // constructible domain: already rounded to 4 decimals, inside clamp range
  return Math.round((0.05 + rng() * 0.9) * 10000) / 10000;
}

function arbContent(rng: () => number, i: number): PaneContent {
  const pick = Math.floor(rng() * 8);
  switch (pick) {
    case 0:
      return { type: 'session', sessionId: `ch-${i}`, cwd: `/repo/wt-${i}` };
    case 1:
      return { type: 'session', sessionId: null, cwd: null };
    case 6:
      // rail state（tmux-workspace-ui P3）— roundtrip 必須保留
      return {
        type: 'session',
        sessionId: `ch-${i}`,
        cwd: `/repo/wt-${i}`,
        rail: { open: rng() > 0.5, tab: (['files', 'git', 'spec'] as const)[i % 3]! },
      };
    case 7:
      // rail width（rail resize）— roundtrip 必須保留
      return {
        type: 'session',
        sessionId: `ch-${i}`,
        cwd: `/repo/wt-${i}`,
        rail: {
          open: rng() > 0.5,
          tab: (['files', 'git', 'spec'] as const)[i % 3]!,
          width: 180 + Math.floor(rng() * 380),
        },
      };
    case 2:
      return { type: 'git', target: { kind: 'fixed', cwd: `/repo/wt-${i}` } };
    case 3:
      return { type: 'files', target: { kind: 'fixed', cwd: `/repo/wt-${i}` } };
    case 4:
      return { type: 'openspec', target: { kind: 'fixed', cwd: `/repo/wt-${i}` } };
    default:
      return { type: 'worktrees' };
  }
}

function arbTree(rng: () => number, depth = 0, counter = { n: 0 }): PaneNode {
  counter.n += 1;
  const split = depth < 3 && rng() < 0.5;
  if (!split) {
    return { type: 'leaf', id: `leaf-${counter.n}`, content: arbContent(rng, counter.n) };
  }
  return {
    type: 'split',
    id: `split-${counter.n}`,
    direction: rng() < 0.5 ? 'h' : 'v',
    ratio: roundedRatio(rng),
    first: arbTree(rng, depth + 1, counter),
    second: arbTree(rng, depth + 1, counter),
  };
}

describe('pane-codecs — round-trip identity (2.1)', () => {
  it('deserializeNode(serializeNode(tree)) ≡ tree for 200 random trees', () => {
    const rng = seeded(42);
    for (let i = 0; i < 200; i++) {
      const tree = arbTree(rng);
      expect(deserializeNode(serializeNode(tree))).toEqual(tree);
    }
  });

  it('serializeNode(deserializeNode(wire)) ≡ wire（wire shape 為基準）', () => {
    const rng = seeded(7);
    for (let i = 0; i < 50; i++) {
      const wire = serializeNode(arbTree(rng));
      expect(serializeNode(deserializeNode(wire))).toEqual(wire);
    }
  });
});

describe('pane-codecs — permissive deserialize (2.2)', () => {
  it('preserves dead channelId and deleted-worktree cwd as-is', () => {
    const wire = serializeNode({
      type: 'leaf',
      id: 'p1',
      content: { type: 'session', sessionId: 'ch-dead', cwd: '/gone/worktree' },
    });
    expect(deserializeNode(wire)).toEqual({
      type: 'leaf',
      id: 'p1',
      content: { type: 'session', sessionId: 'ch-dead', cwd: '/gone/worktree' },
    });
  });

  it('preserves tool pane cwd pointing at a removed worktree', () => {
    const node: PaneNode = {
      type: 'leaf',
      id: 'p2',
      content: { type: 'git', target: { kind: 'fixed', cwd: '/deleted/wt' } },
    };
    expect(deserializeNode(serializeNode(node))).toEqual(node);
  });
});

describe('pane-codecs — ratio precision and clamp (2.6 / 2.7)', () => {
  const leaf = (id: string): PaneNode => ({
    type: 'leaf',
    id,
    content: { type: 'worktrees' },
  });

  it('serializeNode rounds ratio to 4 decimal places', () => {
    const wire = serializeNode({
      type: 'split',
      id: 's',
      direction: 'h',
      ratio: 0.6342819,
      first: leaf('a'),
      second: leaf('b'),
    });
    expect(wire).toMatchObject({ ratio: 0.6343 });
  });

  it('rounded ratio is stable across repeated round-trips', () => {
    const once = serializeNode({
      type: 'split',
      id: 's',
      direction: 'h',
      ratio: 0.123456789,
      first: leaf('a'),
      second: leaf('b'),
    });
    const twice = serializeNode(deserializeNode(once));
    expect(twice).toEqual(once);
  });

  it('deserializeNode clamps out-of-range ratios into [0.05, 0.95]', () => {
    const make = (ratio: number) =>
      deserializeNode({
        type: 'split',
        id: 's',
        direction: 'h',
        ratio,
        first: { type: 'leaf', id: 'a', content: { type: 'worktrees' } },
        second: { type: 'leaf', id: 'b', content: { type: 'worktrees' } },
      });
    expect(make(0)).toMatchObject({ ratio: 0.05 });
    expect(make(0.01)).toMatchObject({ ratio: 0.05 });
    expect(make(1)).toMatchObject({ ratio: 0.95 });
    expect(make(-3)).toMatchObject({ ratio: 0.05 });
    expect(make(Number.NaN)).toMatchObject({ ratio: 0.05 });
  });
});

describe('pane-codecs — serializeLayout (version envelope)', () => {
  it('emits version 2 and maps tabs', () => {
    const layout = serializeLayout({
      workspaceTabs: [
        {
          id: 't1',
          label: 'main',
          paneRoot: {
            type: 'leaf',
            id: 'p1',
            content: { type: 'session', sessionId: 'ch-1', cwd: '/repo' },
          },
        },
      ],
      activeWorkspaceTabId: 't1',
    });
    expect(layout).toEqual({
      version: 2,
      tabs: [
        {
          id: 't1',
          label: 'main',
          paneRoot: {
            type: 'leaf',
            id: 'p1',
            content: { type: 'session', channelId: 'ch-1', cwd: '/repo' },
          },
        },
      ],
      activeTabId: 't1',
    });
  });
});

describe("pane-codecs — reserved 'follow' target degrades (D5 placeholder)", () => {
  it('deserializes a follow-target tool pane into an empty session leaf', () => {
    const node = deserializeNode({
      type: 'leaf',
      id: 'p9',
      content: { type: 'git', target: { kind: 'follow' } },
    });
    expect(node).toEqual({
      type: 'leaf',
      id: 'p9',
      content: { type: 'session', sessionId: null, cwd: null },
    });
  });
});
