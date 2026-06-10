/**
 * Pure PaneContent ⇄ PersistedPaneContent codecs — zero React imports.
 *
 * Contracts (pane-tree-named-components D2/D3, specs/pane-codecs):
 * - Pure functions of the tree: no tabs map, no ctx params (stale-closure proof).
 * - Permissive deserialize: never validates cwd existence or session liveness —
 *   those are render-time concerns.
 * - Round-trip identity over the constructible domain: serialize∘deserialize ≡ id
 *   (wire shape as the reference; the reserved 'follow' target is the documented
 *   exception — it degrades to an empty session leaf until worktree-centric D5).
 * - Session codec maps sessionId (client) ⇄ channelId (wire) as the only rename.
 */
import type { PersistedLayout, PersistedTab } from '@code-quest/schemas';
import { LAYOUT_SCHEMA_VERSION } from '@code-quest/schemas';
import type { PaneContent, PaneNode } from './TabContext.tsx';

type PersistedPaneNode = PersistedTab['paneRoot'];
type PersistedPaneContent = Extract<PersistedPaneNode, { type: 'leaf' }>['content'];
type PersistedTarget = Extract<PersistedPaneContent, { type: 'git' }>['target'];

type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
/** Compile-time guard: client and wire content-type unions must not drift. */
const PANE_TYPE_KEYS_MATCH: AssertEqual<PaneContent['type'], PersistedPaneContent['type']> = true;
void PANE_TYPE_KEYS_MATCH;

// ── content codecs（mapped types — 新增 type 漏寫直接編譯錯）──

type Serializers = {
  [K in PaneContent['type']]: (
    content: Extract<PaneContent, { type: K }>,
  ) => Extract<PersistedPaneContent, { type: K }>;
};

const SERIALIZERS: Serializers = {
  session: (c) => ({ type: 'session', channelId: c.sessionId, cwd: c.cwd }),
  git: (c) => ({ type: 'git', target: c.target }),
  files: (c) => ({ type: 'files', target: c.target }),
  openspec: (c) => ({ type: 'openspec', target: c.target }),
  worktrees: () => ({ type: 'worktrees' }),
};

function serializeContent<K extends PaneContent['type']>(
  content: Extract<PaneContent, { type: K }>,
): Extract<PersistedPaneContent, { type: K }> {
  const serializer: Serializers[K] = SERIALIZERS[content.type];
  return serializer(content);
}

function fromTarget(type: 'git' | 'files' | 'openspec', target: PersistedTarget): PaneContent {
  if (target.kind === 'fixed') {
    return { type, target: { kind: 'fixed', cwd: target.cwd } };
  }
  // 'follow' is reserved (worktree-centric D5); degrade to empty session until implemented
  return { type: 'session', sessionId: null, cwd: null };
}

type Deserializers = {
  [K in PersistedPaneContent['type']]: (
    persisted: Extract<PersistedPaneContent, { type: K }>,
  ) => PaneContent;
};

const DESERIALIZERS: Deserializers = {
  session: (p) => ({ type: 'session', sessionId: p.channelId, cwd: p.cwd }),
  git: (p) => fromTarget('git', p.target),
  files: (p) => fromTarget('files', p.target),
  openspec: (p) => fromTarget('openspec', p.target),
  worktrees: () => ({ type: 'worktrees' }),
};

function deserializeContent<K extends PersistedPaneContent['type']>(
  persisted: Extract<PersistedPaneContent, { type: K }>,
): PaneContent {
  const deserializer: Deserializers[K] = DESERIALIZERS[persisted.type];
  return deserializer(persisted);
}

// ── node codecs（ratio: serialize round 4 位、deserialize clamp [0.05, 0.95]）──

function roundRatio(ratio: number): number {
  return Math.round(ratio * 10000) / 10000;
}

function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.05;
  return Math.min(0.95, Math.max(0.05, ratio));
}

export function serializeNode(node: PaneNode): PersistedPaneNode {
  if (node.type === 'leaf') {
    return { type: 'leaf', id: node.id, content: serializeContent(node.content) };
  }
  return {
    type: 'split',
    id: node.id,
    direction: node.direction,
    ratio: roundRatio(node.ratio),
    first: serializeNode(node.first),
    second: serializeNode(node.second),
  };
}

export function deserializeNode(node: PersistedPaneNode): PaneNode {
  if (node.type === 'leaf') {
    return { type: 'leaf', id: node.id, content: deserializeContent(node.content) };
  }
  return {
    type: 'split',
    id: node.id,
    direction: node.direction,
    ratio: clampRatio(node.ratio),
    first: deserializeNode(node.first),
    second: deserializeNode(node.second),
  };
}

// ── layout envelope ──

interface SerializableTab {
  id: string;
  label?: string;
  paneRoot: PaneNode;
}

export function serializeLayout(wsState: {
  workspaceTabs: SerializableTab[];
  activeWorkspaceTabId: string | null;
}): PersistedLayout {
  return {
    version: LAYOUT_SCHEMA_VERSION,
    tabs: wsState.workspaceTabs.map(serializeTab),
    activeTabId: wsState.activeWorkspaceTabId ?? wsState.workspaceTabs[0]?.id ?? '',
  };
}

function serializeTab(tab: SerializableTab): PersistedTab {
  return { id: tab.id, label: tab.label, paneRoot: serializeNode(tab.paneRoot) };
}
