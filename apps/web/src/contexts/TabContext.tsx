import type { SessionStateSummary } from '@code-quest/schemas';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import type { SessionStatus } from '../types/ui.ts';
import type { SessionMode } from './channel/ChannelContext.tsx';
// Intentional dependency — NavigationContext mediates sidebar/editor
// intents (activate channel, open worktree). Soft-bound via direct useContext
// so TabProvider can be mounted standalone in tests without a NavigationProvider.
import { NavigationActionsContext, NavigationStateContext } from './NavigationContext.tsx';
import { TERMINAL_STATES } from './session-states.ts';

// ── Pane tree types ──

export type PaneContent =
  | { type: 'session'; sessionId: string | null }
  | { type: 'git'; cwd: string }
  | { type: 'files'; cwd: string }
  | { type: 'spec'; cwd: string }
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

// ── Pane state context ──

interface PaneStateValue {
  paneRoot: PaneNode;
  focusedPaneId: string | null;
  zoomedPaneId: string | null;
}

const PaneStateContext: React.Context<PaneStateValue | null> = createContext<PaneStateValue | null>(
  null,
);

export function usePaneState(): PaneStateValue {
  const ctx = useContext(PaneStateContext);
  if (!ctx) throw new Error('usePaneState must be used within a TabProvider');
  return ctx;
}

// ── Pane actions context ──

interface PaneActionsValue {
  splitPane: (direction: 'h' | 'v') => void;
  splitPaneAndAssign: (direction: 'h' | 'v', sessionId: string) => void;
  closePane: (paneId: string) => void;
  focusPane: (paneId: string) => void;
  updateRatio: (splitNodeId: string, ratio: number) => void;
  setSessionInPane: (paneId: string, sessionId: string | null) => void;
  setContentInPane: (paneId: string, content: PaneContent) => void;
  zoomPane: (paneId: string | null) => void;
}

const PaneActionsContext: React.Context<PaneActionsValue | null> =
  createContext<PaneActionsValue | null>(null);

export function usePaneActions(): PaneActionsValue {
  const ctx = useContext(PaneActionsContext);
  if (!ctx) throw new Error('usePaneActions must be used within a TabProvider');
  return ctx;
}

// ── Pane tree helpers ──

function makeLeaf(content: PaneContent = { type: 'session', sessionId: null }): PaneNode {
  return { type: 'leaf', id: crypto.randomUUID(), content };
}

function splitNode(root: PaneNode, focusedId: string | null, direction: 'h' | 'v'): PaneNode {
  const targetId = focusedId ?? (root.type === 'leaf' ? root.id : null);
  if (!targetId) return root;
  return mapNode(root, (node) => {
    if (node.type === 'leaf' && node.id === targetId) {
      return {
        type: 'split',
        id: crypto.randomUUID(),
        direction,
        ratio: 0.5,
        first: node,
        second: makeLeaf(),
      };
    }
    return node;
  });
}

export function firstLeafId(node: PaneNode): string | null {
  if (node.type === 'leaf') return node.id;
  return firstLeafId(node.first) ?? firstLeafId(node.second);
}

function hasLeaf(node: PaneNode, id: string): boolean {
  if (node.type === 'leaf') return node.id === id;
  return hasLeaf(node.first, id) || hasLeaf(node.second, id);
}

export function findPaneBySession(node: PaneNode, channelId: string): string | null {
  if (node.type === 'leaf') {
    return node.content.type === 'session' && node.content.sessionId === channelId ? node.id : null;
  }
  return findPaneBySession(node.first, channelId) ?? findPaneBySession(node.second, channelId);
}

function splitNodeAndAssign(
  root: PaneNode,
  focusedId: string | null,
  direction: 'h' | 'v',
  sessionId: string,
): { root: PaneNode; newLeafId: string } {
  // Guard against stale focused IDs (e.g. from close-button click bubbling to SplitPaneLeaf)
  const validFocusedId = focusedId && hasLeaf(root, focusedId) ? focusedId : null;
  const targetId = validFocusedId ?? firstLeafId(root);
  if (!targetId) return { root, newLeafId: '' };
  const newLeaf = makeLeaf({ type: 'session', sessionId });
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

function closeNode(root: PaneNode, paneId: string): PaneNode {
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

function mapNode(node: PaneNode, fn: (n: PaneNode) => PaneNode): PaneNode {
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

// ── WorkspaceTab (tmux window) ──

export interface WorkspaceTab {
  id: string;
  label?: string;
  paneRoot: PaneNode;
  focusedPaneId: string | null;
  zoomedPaneId: string | null;
}

function makeWorkspaceTab(label?: string): WorkspaceTab {
  return {
    id: crypto.randomUUID(),
    label,
    paneRoot: makeLeaf(),
    focusedPaneId: null,
    zoomedPaneId: null,
  };
}

interface WorkspaceTabStateValue {
  workspaceTabs: WorkspaceTab[];
  activeWorkspaceTabId: string | null;
}

const WorkspaceTabStateContext: React.Context<WorkspaceTabStateValue | null> =
  createContext<WorkspaceTabStateValue | null>(null);

function useWorkspaceTabState(): WorkspaceTabStateValue {
  const ctx = useContext(WorkspaceTabStateContext);
  if (!ctx) throw new Error('useWorkspaceTabState must be used within a TabProvider');
  return ctx;
}

interface WorkspaceTabActionsValue {
  addWorkspaceTab: (label?: string) => void;
  removeWorkspaceTab: (id: string) => void;
  switchWorkspaceTab: (id: string) => void;
  renameWorkspaceTab: (id: string, label: string) => void;
}

const WorkspaceTabActionsContext: React.Context<WorkspaceTabActionsValue | null> =
  createContext<WorkspaceTabActionsValue | null>(null);

function useWorkspaceTabActions(): WorkspaceTabActionsValue {
  const ctx = useContext(WorkspaceTabActionsContext);
  if (!ctx) throw new Error('useWorkspaceTabActions must be used within a TabProvider');
  return ctx;
}

export function useWorkspaceTab(): WorkspaceTabStateValue & WorkspaceTabActionsValue {
  return { ...useWorkspaceTabState(), ...useWorkspaceTabActions() };
}

export interface TabMeta {
  title?: string;
  tabStatus: SessionStatus;
  cwd?: string;
  branch?: string;
  mode: SessionMode;
}

// ── State context (changes frequently) ──

interface TabStateValue {
  tabs: Record<string, TabMeta>;
  activeTabId: string | null;
}

const TabStateContext: React.Context<TabStateValue | null> = createContext<TabStateValue | null>(
  null,
);

export function useTabState(): TabStateValue {
  const ctx = useContext(TabStateContext);
  if (!ctx) throw new Error('useTabState must be used within a TabProvider');
  return ctx;
}

// ── Actions context (stable references) ──

interface TabActionsValue {
  addTab: (id: string, cwd?: string, branch?: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setTabTitle: (id: string, title: string) => void;
  setTabStatus: (id: string, status: TabMeta['tabStatus']) => void;
  createNewTab: (opts?: { cwd?: string }) => { channelId: string };
  replaceActiveTab: (newChannelId: string, cwd?: string, branch?: string) => void;
  replaceTab: (oldChannelId: string, newChannelId: string) => void;
}

const TabActionsContext: React.Context<TabActionsValue | null> =
  createContext<TabActionsValue | null>(null);

export function useTabActions(): TabActionsValue {
  const ctx = useContext(TabActionsContext);
  if (!ctx) throw new Error('useTabActions must be used within a TabProvider');
  return ctx;
}

// ── Provider ──

const DEFAULT_META: TabMeta = { title: undefined, tabStatus: 'connecting', mode: 'resume' };

export function TabProvider({
  children,
  initialState,
  sessions,
  cwd,
  selectedCwd,
}: {
  children: ReactNode;
  initialState?: { tabs: Record<string, TabMeta>; activeTabId: string | null };
  sessions?: SessionStateSummary[];
  cwd?: string;
  /** Sidebar selection within this project. When set, `createNewTab()` (no
   *  args) uses this instead of `cwd`. Lets `+` open a chat in the
   *  currently-browsed worktree without explicit cwd plumbing. */
  selectedCwd?: string;
}): React.JSX.Element {
  const [state, setState] = useState<TabStateValue>(() => ({
    tabs: initialState?.tabs ?? {},
    activeTabId: initialState?.activeTabId ?? null,
  }));

  // cwd prop is read inside stable actions via ref so actions keep a single
  // identity across renders (otherwise downstream memoization breaks).
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;
  const selectedCwdRef = useRef(selectedCwd);
  selectedCwdRef.current = selectedCwd;

  const [actions] = useState<TabActionsValue>(() => ({
    addTab: (id, cwd, branch) => {
      setState((prev) => {
        if (id in prev.tabs) return prev;
        const tabs = { ...prev.tabs, [id]: { ...DEFAULT_META, cwd, branch } };
        return { ...prev, tabs, activeTabId: prev.activeTabId ?? id };
      });
    },
    removeTab: (id) => {
      setState((prev) => {
        if (!(id in prev.tabs)) return prev;
        const { [id]: _, ...rest } = prev.tabs;
        const wasActive = prev.activeTabId === id;
        const activeTabId = wasActive ? (Object.keys(rest)[0] ?? null) : prev.activeTabId;
        return { tabs: rest, activeTabId };
      });
    },
    setActiveTab: (id) => {
      setState((prev) => (prev.activeTabId === id ? prev : { ...prev, activeTabId: id }));
    },
    setTabTitle: (id, title) => {
      setState((prev) => {
        const existing = prev.tabs[id];
        if (!existing) return prev;
        return { ...prev, tabs: { ...prev.tabs, [id]: { ...existing, title } } };
      });
    },
    setTabStatus: (id, status) => {
      setState((prev) => {
        const existing = prev.tabs[id];
        if (!existing) return prev;
        return { ...prev, tabs: { ...prev.tabs, [id]: { ...existing, tabStatus: status } } };
      });
    },
    createNewTab: (opts) => {
      const channelId = crypto.randomUUID();
      const tabCwd = opts?.cwd ?? selectedCwdRef.current ?? cwdRef.current;
      setState((prev) => ({
        ...prev,
        tabs: {
          ...prev.tabs,
          [channelId]: { ...DEFAULT_META, cwd: tabCwd, mode: 'new' },
        },
        activeTabId: channelId,
      }));
      return { channelId };
    },
    replaceActiveTab: (newChannelId, cwd, branch) => {
      setState((prev) => {
        if (!prev.activeTabId) return prev;
        const { [prev.activeTabId]: _, ...rest } = prev.tabs;
        return {
          ...prev,
          tabs: { ...rest, [newChannelId]: { ...DEFAULT_META, cwd, branch } },
          activeTabId: newChannelId,
        };
      });
    },
    replaceTab: (oldChannelId, newChannelId) => {
      setState((prev) => {
        const old = prev.tabs[oldChannelId];
        if (!old) return prev;
        const { [oldChannelId]: _, ...rest } = prev.tabs;
        return {
          ...prev,
          tabs: { ...rest, [newChannelId]: { ...old } },
          activeTabId: prev.activeTabId === oldChannelId ? newChannelId : prev.activeTabId,
        };
      });
    },
  }));

  const prevSessionIds = useRef<Set<string>>(new Set());
  // biome-ignore lint/correctness/useExhaustiveDependencies: addTab/removeTab/replaceActiveTab only call setState — deps are intentionally limited to sessions to avoid re-running the diff on every render
  useEffect(() => {
    if (!sessions) return;
    const currentIds = new Set(sessions.map((s) => s.channelId));
    const added = sessions.filter(
      (s) => !prevSessionIds.current.has(s.channelId) && !TERMINAL_STATES.has(s.state),
    );
    const removed = [...prevSessionIds.current].filter((id) => !currentIds.has(id));
    if (added.length === 1 && removed.length === 1 && added[0] && removed[0]) {
      actions.replaceActiveTab(added[0].channelId, added[0].cwd, added[0].branch);
    } else {
      for (const s of added) {
        actions.addTab(s.channelId, s.cwd, s.branch);
      }
      for (const id of removed) {
        actions.removeTab(id);
      }
    }
    prevSessionIds.current = currentIds;
  }, [sessions]);

  // Consume pendingActivateChannel intent from NavigationContext.
  // Fires only when (a) the cwd matches our own AND (b) the channel is
  // already in our tabs. Otherwise we wait — the sessions-prop effect above
  // may add the channel later, and this effect will re-run via the tabs dep.
  // Dep array MUST include both pendingActivateChannel AND state.tabs,
  // otherwise a pending intent that lands before auto-addTab is silently lost.
  const navState = useContext(NavigationStateContext);
  const navActions = useContext(NavigationActionsContext);
  const pendingActivateChannel = navState?.pendingActivateChannel ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: setActiveTab is a local closure that only calls setState; navActions identity is preserved by NavigationProvider's useState initializer
  useEffect(() => {
    if (!pendingActivateChannel || !navActions) return;
    // Global TabProvider handles all channels — no cwd guard needed
    if (!(pendingActivateChannel.channelId in state.tabs)) return;
    actions.setActiveTab(pendingActivateChannel.channelId);
    navActions.clearPendingActivate();
  }, [pendingActivateChannel, state.tabs]);

  // Consume pendingOpenWorktree intent — sidebar clicked a worktree row.
  // Global TabProvider handles all projects — no projectCwd guard needed.
  const pendingOpenWorktree = navState?.pendingOpenWorktree ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: same reasoning as pendingActivateChannel effect — actions identity is stable
  useEffect(() => {
    if (!pendingOpenWorktree || !navActions) return;
    const existingId = pendingOpenWorktree.forceNew
      ? undefined
      : Object.entries(state.tabs).find(
          ([, meta]) => meta.cwd === pendingOpenWorktree.worktreeCwd,
        )?.[0];
    if (existingId) {
      actions.setActiveTab(existingId);
    } else {
      // Mockup's openWt: when no matching tab exists, create one (open-or-switch).
      // Duplicate-tab creation stays behind ⋯ menu "Open in new chat" (forceNew=true).
      actions.createNewTab({ cwd: pendingOpenWorktree.worktreeCwd });
    }
    navActions.clearPendingOpenWorktree();
  }, [pendingOpenWorktree, state.tabs, cwd]);

  const initialWorkspaceTab = makeWorkspaceTab();
  const [wsState, setWsState] = useState<WorkspaceTabStateValue>(() => ({
    workspaceTabs: [initialWorkspaceTab],
    activeWorkspaceTabId: initialWorkspaceTab.id,
  }));

  function updateActiveTab(updater: (tab: WorkspaceTab) => WorkspaceTab) {
    setWsState((prev) => ({
      ...prev,
      workspaceTabs: prev.workspaceTabs.map((t) =>
        t.id === prev.activeWorkspaceTabId ? updater(t) : t,
      ),
    }));
  }

  const [wsActions] = useState<WorkspaceTabActionsValue>(() => ({
    addWorkspaceTab: (label) => {
      const tab = makeWorkspaceTab(label);
      setWsState((prev) => ({
        workspaceTabs: [...prev.workspaceTabs, tab],
        activeWorkspaceTabId: tab.id,
      }));
    },
    removeWorkspaceTab: (id) => {
      setWsState((prev) => {
        const remaining = prev.workspaceTabs.filter((t) => t.id !== id);
        if (remaining.length === 0) return prev; // keep at least one
        const newActive =
          prev.activeWorkspaceTabId === id
            ? (remaining[remaining.length - 1]?.id ?? null)
            : prev.activeWorkspaceTabId;
        return { workspaceTabs: remaining, activeWorkspaceTabId: newActive };
      });
    },
    switchWorkspaceTab: (id) => {
      setWsState((prev) =>
        prev.activeWorkspaceTabId === id ? prev : { ...prev, activeWorkspaceTabId: id },
      );
    },
    renameWorkspaceTab: (id, label) => {
      setWsState((prev) => ({
        ...prev,
        workspaceTabs: prev.workspaceTabs.map((t) => (t.id === id ? { ...t, label } : t)),
      }));
    },
  }));

  const [paneActions] = useState<PaneActionsValue>(() => ({
    splitPane: (direction) => {
      updateActiveTab((t) => ({
        ...t,
        paneRoot: splitNode(t.paneRoot, t.focusedPaneId, direction),
      }));
    },
    splitPaneAndAssign: (direction, sessionId) => {
      updateActiveTab((t) => {
        const { root: newRoot, newLeafId } = splitNodeAndAssign(
          t.paneRoot,
          t.focusedPaneId,
          direction,
          sessionId,
        );
        return { ...t, paneRoot: newRoot, focusedPaneId: newLeafId };
      });
    },
    closePane: (paneId) => {
      updateActiveTab((t) => {
        const next = closeNode(t.paneRoot, paneId);
        return {
          ...t,
          paneRoot: next,
          focusedPaneId: t.focusedPaneId === paneId ? null : t.focusedPaneId,
          zoomedPaneId: t.zoomedPaneId === paneId ? null : t.zoomedPaneId,
        };
      });
    },
    focusPane: (paneId) => {
      updateActiveTab((t) => (t.focusedPaneId === paneId ? t : { ...t, focusedPaneId: paneId }));
    },
    updateRatio: (splitNodeId, ratio) => {
      updateActiveTab((t) => ({
        ...t,
        paneRoot: mapNode(t.paneRoot, (node) =>
          node.type === 'split' && node.id === splitNodeId ? { ...node, ratio } : node,
        ),
      }));
    },
    setSessionInPane: (paneId, sessionId) => {
      updateActiveTab((t) => ({
        ...t,
        paneRoot: mapNode(t.paneRoot, (node) =>
          node.type === 'leaf' && node.id === paneId
            ? { ...node, content: { type: 'session', sessionId } }
            : node,
        ),
      }));
    },
    setContentInPane: (paneId, content) => {
      updateActiveTab((t) => ({
        ...t,
        paneRoot: mapNode(t.paneRoot, (node) =>
          node.type === 'leaf' && node.id === paneId ? { ...node, content } : node,
        ),
      }));
    },
    zoomPane: (paneId) => {
      updateActiveTab((t) => (t.zoomedPaneId === paneId ? t : { ...t, zoomedPaneId: paneId }));
    },
  }));

  const activeWsTab = wsState.workspaceTabs.find((t) => t.id === wsState.activeWorkspaceTabId);
  const paneState: PaneStateValue = activeWsTab ?? {
    paneRoot: makeLeaf(),
    focusedPaneId: null,
    zoomedPaneId: null,
  };

  return (
    <TabStateContext.Provider value={state}>
      <TabActionsContext.Provider value={actions}>
        <WorkspaceTabStateContext.Provider value={wsState}>
          <WorkspaceTabActionsContext.Provider value={wsActions}>
            <PaneStateContext.Provider value={paneState}>
              <PaneActionsContext.Provider value={paneActions}>
                {children}
              </PaneActionsContext.Provider>
            </PaneStateContext.Provider>
          </WorkspaceTabActionsContext.Provider>
        </WorkspaceTabStateContext.Provider>
      </TabActionsContext.Provider>
    </TabStateContext.Provider>
  );
}
