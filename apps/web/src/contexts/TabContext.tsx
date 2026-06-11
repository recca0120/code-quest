/**
 * Session tab domain: per-channel TabMeta map + sessions-prop diff sync +
 * NavigationContext intent consumption. The workspace-layout domain
 * (workspace tabs / pane tree / persistence) lives in WorkspaceLayoutContext —
 * TabProvider mounts it so existing usage keeps working unchanged; all pane
 * tree types/algorithms and layout hooks are re-exported from here.
 */
import type { SessionStateSummary } from '@code-quest/schemas';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import type { SessionStatus } from '../types/ui.ts';
import type { SessionMode } from './channel/ChannelContext.tsx';
import { TERMINAL_STATES } from './session-states.ts';
import { WorkspaceLayoutProvider } from './WorkspaceLayoutContext.tsx';

// ── Re-exports（拆分前的公開介面維持不變）──

export type { PaneContent, PaneNode, RailState, RailTab, WorkspaceTab } from './pane-tree.ts';
export {
  buildSessionPaneLabels,
  collectSessionsInPaneTree,
  findPaneBySession,
  firstLeafId,
  firstPaneCwd,
  hasLeaf,
  paneCwd,
} from './pane-tree.ts';
export {
  usePaneActions,
  usePaneState,
  useWorkspaceTab,
  useWorkspaceTabState,
} from './WorkspaceLayoutContext.tsx';

// ── Session tab meta ──

export interface TabMeta {
  title?: string;
  tabStatus: SessionStatus;
  cwd?: string;
  /** Owning project root — written at creation (worktree-centric D2). */
  projectCwd?: string;
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
  addTab: (id: string, cwd?: string, branch?: string, projectCwd?: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setTabTitle: (id: string, title: string) => void;
  setTabStatus: (id: string, status: TabMeta['tabStatus']) => void;
  createNewTab: (opts?: { cwd?: string; projectCwd?: string; branch?: string }) => {
    channelId: string;
    cwd: string | null;
  };
  replaceActiveTab: (
    newChannelId: string,
    cwd?: string,
    branch?: string,
    projectCwd?: string,
  ) => void;
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
    addTab: (id, cwd, branch, projectCwd) => {
      setState((prev) => {
        if (id in prev.tabs) return prev;
        const tabs = { ...prev.tabs, [id]: { ...DEFAULT_META, cwd, branch, projectCwd } };
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
          [channelId]: {
            ...DEFAULT_META,
            cwd: tabCwd,
            projectCwd: opts?.projectCwd,
            branch: opts?.branch,
            mode: 'new',
          },
        },
        activeTabId: channelId,
      }));
      return { channelId, cwd: tabCwd ?? null };
    },
    replaceActiveTab: (newChannelId, cwd, branch, projectCwd) => {
      setState((prev) => {
        if (!prev.activeTabId) return prev;
        const { [prev.activeTabId]: _, ...rest } = prev.tabs;
        return {
          ...prev,
          tabs: { ...rest, [newChannelId]: { ...DEFAULT_META, cwd, branch, projectCwd } },
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
  // Latest activeTabId for the diff effect (deps limited to [sessions])
  const activeTabIdRef = useRef(state.activeTabId);
  activeTabIdRef.current = state.activeTabId;
  // biome-ignore lint/correctness/useExhaustiveDependencies: addTab/removeTab/replaceActiveTab only call setState — deps are intentionally limited to sessions to avoid re-running the diff on every render
  useEffect(() => {
    if (!sessions) return;
    const currentIds = new Set(sessions.map((s) => s.channelId));
    const added = sessions.filter(
      (s) => !prevSessionIds.current.has(s.channelId) && !TERMINAL_STATES.has(s.state),
    );
    const removed = [...prevSessionIds.current].filter((id) => !currentIds.has(id));
    if (
      added.length === 1 &&
      removed.length === 1 &&
      added[0] &&
      removed[0] &&
      // Swap semantics only apply when the dying session IS the active tab —
      // otherwise a background session ending alongside a new one appearing
      // would kill the user's active tab and leave the dead one as a zombie.
      removed[0] === activeTabIdRef.current
    ) {
      actions.replaceActiveTab(
        added[0].channelId,
        added[0].cwd,
        added[0].branch,
        added[0].projectRoot,
      );
    } else {
      for (const s of added) {
        actions.addTab(s.channelId, s.cwd, s.branch, s.projectRoot);
      }
      for (const id of removed) {
        actions.removeTab(id);
      }
    }
    prevSessionIds.current = currentIds;
  }, [sessions]);

  return (
    <TabStateContext.Provider value={state}>
      <TabActionsContext.Provider value={actions}>
        <WorkspaceLayoutProvider>{children}</WorkspaceLayoutProvider>
      </TabActionsContext.Provider>
    </TabStateContext.Provider>
  );
}
