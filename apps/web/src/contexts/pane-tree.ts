/**
 * Pane tree data types + pure algorithms — zero React imports.
 * The single source for PaneContent/PaneNode shapes; pane-codecs and the
 * workspace-layout provider both build on this module (no import cycles).
 */

// 'follow' variant joins at worktree-centric D5 — shape reserved in wire v2, not constructible yet
type PaneTarget = { kind: 'fixed'; cwd: string };

export type RailTab = 'files' | 'git' | 'spec';
export interface RailState {
  open: boolean;
  tab: RailTab;
}

export type PaneContent =
  | { type: 'session'; sessionId: string | null; cwd: string | null; rail?: RailState }
  | { type: 'git'; target: PaneTarget }
  | { type: 'files'; target: PaneTarget }
  | { type: 'openspec'; target: PaneTarget }
  | { type: 'worktrees' };

export type PaneNode =
  | { type: 'leaf'; id: string; content: PaneContent }
  | {
      type: 'split';
      id: string;
      direction: 'h' | 'v';
      ratio: number;
      first: PaneNode;
      second: PaneNode;
    };

// ── WorkspaceTab (tmux window) ──

export interface WorkspaceTab {
  id: string;
  label?: string;
  paneRoot: PaneNode;
  focusedPaneId: string | null;
  zoomedPaneId: string | null;
}

export interface WorkspaceTabStateValue {
  workspaceTabs: WorkspaceTab[];
  activeWorkspaceTabId: string | null;
}

export function makeWorkspaceTab(label?: string): WorkspaceTab {
  return {
    id: crypto.randomUUID(),
    label,
    paneRoot: makeLeaf(),
    focusedPaneId: null,
    zoomedPaneId: null,
  };
}

// ── Tree algorithms ──

export function makeLeaf(
  content: PaneContent = { type: 'session', sessionId: null, cwd: null },
): PaneNode {
  return { type: 'leaf', id: crypto.randomUUID(), content };
}

/** Structural-sharing map: untouched subtrees keep their identity (memo-friendly). */
export function mapNode(node: PaneNode, fn: (n: PaneNode) => PaneNode): PaneNode {
  const mapped = fn(node);
  if (mapped !== node) return mapped;
  if (node.type === 'split') {
    const first = mapNode(node.first, fn);
    const second = mapNode(node.second, fn);
    if (first === node.first && second === node.second) return node;
    return { ...node, first, second };
  }
  return node;
}

export function splitNode(
  root: PaneNode,
  focusedId: string | null,
  direction: 'h' | 'v',
): { root: PaneNode; newLeafId: string | null } {
  const targetId = focusedId ?? (root.type === 'leaf' ? root.id : null);
  if (!targetId) return { root, newLeafId: null };
  let newLeafId: string | null = null;
  const newRoot = mapNode(root, (node) => {
    if (node.type === 'leaf' && node.id === targetId) {
      const newLeaf = makeLeaf();
      newLeafId = newLeaf.id;
      return {
        type: 'split',
        id: crypto.randomUUID(),
        direction,
        ratio: 0.5,
        first: node,
        second: newLeaf,
      };
    }
    return node;
  });
  return { root: newRoot, newLeafId };
}

export function splitNodeAndAssign(
  root: PaneNode,
  focusedId: string | null,
  direction: 'h' | 'v',
  sessionId: string,
  cwd: string | null,
): { root: PaneNode; newLeafId: string } {
  // Guard against stale focused IDs (e.g. from close-button click bubbling to PaneLeaf)
  const validFocusedId = focusedId && hasLeaf(root, focusedId) ? focusedId : null;
  const targetId = validFocusedId ?? firstLeafId(root);
  if (!targetId) return { root, newLeafId: '' };
  const newLeaf = makeLeaf({ type: 'session', sessionId, cwd });
  const newRoot = mapNode(root, (node) => {
    if (node.type === 'leaf' && node.id === targetId) {
      return {
        type: 'split',
        id: crypto.randomUUID(),
        direction,
        ratio: 0.5,
        first: node,
        second: newLeaf,
      };
    }
    return node;
  });
  return { root: newRoot, newLeafId: newLeaf.id };
}

export function closeNode(root: PaneNode, paneId: string): PaneNode {
  if (root.type === 'leaf') return root; // can't close the only pane
  return collapseRemove(root, paneId) ?? root;
}

function collapseRemove(node: PaneNode, paneId: string): PaneNode | null {
  if (node.type === 'leaf') return node.id === paneId ? null : node;
  const first = collapseRemove(node.first, paneId);
  const second = collapseRemove(node.second, paneId);
  if (first === null) return second;
  if (second === null) return first;
  return { ...node, first, second };
}

export function firstLeafId(node: PaneNode): string | null {
  if (node.type === 'leaf') return node.id;
  return firstLeafId(node.first) ?? firstLeafId(node.second);
}

export function hasLeaf(node: PaneNode, id: string): boolean {
  if (node.type === 'leaf') return node.id === id;
  return hasLeaf(node.first, id) || hasLeaf(node.second, id);
}

function leafCwd(content: PaneContent): string | null {
  if (content.type === 'session') return content.cwd;
  if ('target' in content && content.target.kind === 'fixed') return content.target.cwd;
  return null;
}

/** 第一個帶 cwd 的 leaf 的 cwd（先序）— tab 預設命名的來源。 */
export function firstPaneCwd(node: PaneNode): string | null {
  if (node.type === 'leaf') return leafCwd(node.content);
  return firstPaneCwd(node.first) ?? firstPaneCwd(node.second);
}

/** 指定 pane 的 cwd — 狀態列 focused context 的來源。 */
export function paneCwd(node: PaneNode, paneId: string): string | null {
  if (node.type === 'leaf') return node.id === paneId ? leafCwd(node.content) : null;
  return paneCwd(node.first, paneId) ?? paneCwd(node.second, paneId);
}

export function findPaneBySession(node: PaneNode, channelId: string): string | null {
  if (node.type === 'leaf') {
    return node.content.type === 'session' && node.content.sessionId === channelId ? node.id : null;
  }
  return findPaneBySession(node.first, channelId) ?? findPaneBySession(node.second, channelId);
}

export function collectSessionsInPaneTree(node: PaneNode): Set<string> {
  const ids = new Set<string>();
  function walk(n: PaneNode) {
    if (n.type === 'leaf') {
      if (n.content.type === 'session' && n.content.sessionId) ids.add(n.content.sessionId);
      return;
    }
    walk(n.first);
    walk(n.second);
  }
  walk(node);
  return ids;
}

export function buildSessionPaneLabels(node: PaneNode, path = ''): Map<string, string> {
  if (node.type === 'leaf') {
    const map = new Map<string, string>();
    if (node.content.type === 'session' && node.content.sessionId) {
      map.set(node.content.sessionId, path || 'Pane');
    }
    return map;
  }
  const firstLabel =
    node.direction === 'h'
      ? `${path ? `${path}/` : ''}Left pane`
      : `${path ? `${path}/` : ''}Top pane`;
  const secondLabel =
    node.direction === 'h'
      ? `${path ? `${path}/` : ''}Right pane`
      : `${path ? `${path}/` : ''}Bottom pane`;
  return new Map([
    ...buildSessionPaneLabels(node.first, firstLabel),
    ...buildSessionPaneLabels(node.second, secondLabel),
  ]);
}
