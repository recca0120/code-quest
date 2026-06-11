import { z } from 'zod';

export const LAYOUT_SCHEMA_VERSION = 2;

const paneTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), cwd: z.string() }),
  // Reserved for worktree-centric D5 (follow focused session); parseable but not yet produced
  z.object({ kind: z.literal('follow') }),
]);
export type PaneTargetWire = z.infer<typeof paneTargetSchema>;

const persistedPaneContentSchema = z
  .discriminatedUnion('type', [
    // channelId rebinds still-alive sessions (mode:'resume' join — never spawns);
    // cwd is the restore hint shown when the channel is gone
    z.object({
      type: z.literal('session'),
      channelId: z.string().nullable(),
      cwd: z.string().nullable(),
      // chat 附帶工具（rail/dock）的 per-pane 顯示狀態（tmux-workspace-ui P3）；
      // optional 演進，缺省由 client 補 { open: true, tab: 'files' }
      rail: z.object({ open: z.boolean(), tab: z.enum(['files', 'git', 'spec']) }).optional(),
    }),
    z.object({ type: z.literal('files'), target: paneTargetSchema }),
    z.object({ type: z.literal('git'), target: paneTargetSchema }),
    z.object({ type: z.literal('openspec'), target: paneTargetSchema }),
    z.object({ type: z.literal('worktrees') }),
  ])
  // Unknown-variant tolerance: a pane type from a newer client degrades to an
  // empty session leaf instead of failing the whole layout parse (F2's wire dual)
  .catch({ type: 'session', channelId: null, cwd: null });

type PersistedPaneContent = z.infer<typeof persistedPaneContentSchema>;

type PersistedPaneLeaf = { type: 'leaf'; id: string; content: PersistedPaneContent };
type PersistedPaneSplit = {
  type: 'split';
  id: string;
  direction: 'h' | 'v';
  ratio: number;
  first: PersistedPaneNode;
  second: PersistedPaneNode;
};
type PersistedPaneNode = PersistedPaneLeaf | PersistedPaneSplit;

// Clamp-not-reject: a corrupt ratio must never make safeParse drop the whole layout
const ratioSchema = z.number().refine(Number.isFinite).catch(0.5);

const persistedPaneNodeSchema: z.ZodType<PersistedPaneNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('leaf'),
      id: z.string(),
      content: persistedPaneContentSchema,
    }),
    z.object({
      type: z.literal('split'),
      id: z.string(),
      direction: z.enum(['h', 'v']),
      ratio: ratioSchema,
      first: persistedPaneNodeSchema,
      second: persistedPaneNodeSchema,
    }),
  ]),
) as z.ZodType<PersistedPaneNode>;

export const persistedTabSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  paneRoot: persistedPaneNodeSchema,
});
export type PersistedTab = z.infer<typeof persistedTabSchema>;

export const persistedLayoutSchema = z.object({
  version: z.literal(LAYOUT_SCHEMA_VERSION),
  tabs: z.array(persistedTabSchema),
  activeTabId: z.string(),
});
export type PersistedLayout = z.infer<typeof persistedLayoutSchema>;

/** layout:save 的 RPC ack：成功帶 server 配發的單調遞增 rev（echo guard）。 */
export type LayoutSaveAck = { ok: true; rev: number } | { ok: false; error: string };

/** layout:sync / app:init 下行攜帶 rev；上行 layout:save 不含（server 配發）。 */
export type LayoutSyncPayload = PersistedLayout & { rev: number };

// ── channelId uniqueness (11.5/11.6) ──
// A channelId may bind at most one leaf across ALL workspace tabs — duplicates
// would double-mount ChannelProvider ("Channel already exists"). First wins;
// later occurrences degrade to an empty leaf keeping the cwd restore hint.
// Shared by server (before store/broadcast) and client (before apply).

export function dedupeLayoutChannelIds(layout: PersistedLayout): PersistedLayout {
  const seen = new Set<string>();
  let changed = false;

  function walk(node: PersistedPaneNode): PersistedPaneNode {
    if (node.type === 'leaf') {
      const c = node.content;
      if (c.type === 'session' && c.channelId) {
        if (seen.has(c.channelId)) {
          changed = true;
          return { ...node, content: { type: 'session', channelId: null, cwd: c.cwd } };
        }
        seen.add(c.channelId);
      }
      return node;
    }
    const first = walk(node.first);
    const second = walk(node.second);
    return first === node.first && second === node.second ? node : { ...node, first, second };
  }

  const tabs = layout.tabs.map((t) => {
    const paneRoot = walk(t.paneRoot);
    return paneRoot === t.paneRoot ? t : { ...t, paneRoot };
  });
  return changed ? { ...layout, tabs } : layout;
}

// ── v1 → v2 migration ──
// v1 had no version field: session stored only { cwd }, tool panes a flat { cwd },
// and worktrees was unrepresentable. Runs before parse on any unversioned payload.

function migrateContent(content: unknown): unknown {
  if (typeof content !== 'object' || content === null) return content;
  const c = content as { type?: unknown; cwd?: unknown };
  if (c.type === 'session') {
    return { type: 'session', channelId: null, cwd: typeof c.cwd === 'string' ? c.cwd : null };
  }
  if (
    (c.type === 'git' || c.type === 'files' || c.type === 'openspec') &&
    typeof c.cwd === 'string'
  ) {
    return { type: c.type, target: { kind: 'fixed', cwd: c.cwd } };
  }
  return content;
}

function migrateNode(node: unknown): unknown {
  if (typeof node !== 'object' || node === null) return node;
  const n = node as Record<string, unknown>;
  if (n.type === 'leaf') return { ...n, content: migrateContent(n.content) };
  if (n.type === 'split') {
    return { ...n, first: migrateNode(n.first), second: migrateNode(n.second) };
  }
  return node;
}

/**
 * Upgrade a legacy (unversioned v1) layout payload to v2. v2 payloads pass through
 * unchanged; unrecognizable payloads return null.
 */
export function migrateLegacyToV2(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (p.version === LAYOUT_SCHEMA_VERSION) return payload;
  if (!Array.isArray(p.tabs) || typeof p.activeTabId !== 'string') return null;
  return {
    version: LAYOUT_SCHEMA_VERSION,
    tabs: p.tabs.map((tab) => {
      if (typeof tab !== 'object' || tab === null) return tab;
      const t = tab as Record<string, unknown>;
      return { ...t, paneRoot: migrateNode(t.paneRoot) };
    }),
    activeTabId: p.activeTabId,
  };
}
