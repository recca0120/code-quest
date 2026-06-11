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
  /** rail 拖寬把手的 persist 寬度（px）；缺省走 --rail-w token */
  width?: number;
}

export type PaneContent =
  | { type: 'session'; channelId: string | null; cwd: string | null; rail?: RailState }
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
  content: PaneContent = { type: 'session', channelId: null, cwd: null },
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
  channelId: string,
  cwd: string | null,
): { root: PaneNode; newLeafId: string } {
  // Guard against stale focused IDs (e.g. from close-button click bubbling to PaneLeaf)
  const validFocusedId = focusedId && hasLeaf(root, focusedId) ? focusedId : null;
  const targetId = validFocusedId ?? firstLeafId(root);
  if (!targetId) return { root, newLeafId: '' };
  const newLeaf = makeLeaf({ type: 'session', channelId, cwd });
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

export type DropEdge = 'top' | 'bottom' | 'left' | 'right';

/** 先序遍歷的 leaf 清單（pane 編號的單一來源：①②③…） */
export function leafIdsInOrder(node: PaneNode): string[] {
  if (node.type === 'leaf') return [node.id];
  return [...leafIdsInOrder(node.first), ...leafIdsInOrder(node.second)];
}

/** focused pane 往上最近的指定方向 split（⌥方向鍵微調邊界用）。 */
export function findAncestorSplit(
  root: PaneNode,
  paneId: string,
  direction: 'h' | 'v',
): { splitId: string; ratio: number; paneInFirst: boolean } | null {
  if (root.type === 'leaf') return null;
  const inFirst = hasLeaf(root.first, paneId);
  const inSecond = hasLeaf(root.second, paneId);
  if (!inFirst && !inSecond) return null;
  const child = inFirst ? root.first : root.second;
  // 先往深處找（最近的祖先優先）
  const deeper = findAncestorSplit(child, paneId, direction);
  if (deeper) return deeper;
  if (root.direction === direction) {
    return { splitId: root.id, ratio: root.ratio, paneInFirst: inFirst };
  }
  return null;
}

/** 五落點的方向落點（handoff §7）：source 移除（樹收斂）後，target 於該
 * 方向 split 放入 source 的 content。中央置換走既有 swap。 */
export function movePaneTo(
  root: PaneNode,
  sourceId: string,
  targetId: string,
  edge: DropEdge,
): PaneNode {
  if (sourceId === targetId) return root;
  let sourceLeaf: PaneNode | null = null;
  mapNode(root, (n) => {
    if (n.type === 'leaf' && n.id === sourceId) sourceLeaf = n;
    return n;
  });
  if (!sourceLeaf || !hasLeaf(root, targetId)) return root;
  const removed = closeNode(root, sourceId);
  if (removed === root && root.type === 'split') return root; // source 不存在
  const direction: 'h' | 'v' = edge === 'left' || edge === 'right' ? 'h' : 'v';
  const sourceFirst = edge === 'left' || edge === 'top';
  const moved: PaneNode = sourceLeaf;
  return mapNode(removed, (n) => {
    if (n.type === 'leaf' && n.id === targetId) {
      return {
        type: 'split',
        id: crypto.randomUUID(),
        direction,
        ratio: 0.5,
        first: sourceFirst ? moved : n,
        second: sourceFirst ? n : moved,
      };
    }
    return n;
  });
}

export function findPaneByChannel(node: PaneNode, channelId: string): string | null {
  if (node.type === 'leaf') {
    return node.content.type === 'session' && node.content.channelId === channelId ? node.id : null;
  }
  return findPaneByChannel(node.first, channelId) ?? findPaneByChannel(node.second, channelId);
}

export function collectSessionsInPaneTree(node: PaneNode): Set<string> {
  const ids = new Set<string>();
  function walk(n: PaneNode) {
    if (n.type === 'leaf') {
      if (n.content.type === 'session' && n.content.channelId) ids.add(n.content.channelId);
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
    if (node.content.type === 'session' && node.content.channelId) {
      map.set(node.content.channelId, path || 'Pane');
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
