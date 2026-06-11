/**
 * Workspace layout domain: workspace tabs (tmux windows) + the active tab's
 * pane tree + layout persistence. Split out of TabContext — the two domains
 * share no state (session tab meta lives in TabContext; this provider is
 * mounted by TabProvider so existing mounts keep working unchanged).
 */
import { createContext, type ReactNode, useContext, useState } from 'react';
import {
  closeNode,
  type DropEdge,
  firstLeafId,
  hasLeaf,
  makeLeaf,
  makeWorkspaceTab,
  mapNode,
  movePaneTo,
  type PaneContent,
  type PaneNode,
  splitNode,
  splitNodeAndAssign,
  type WorkspaceTab,
  type WorkspaceTabStateValue,
} from './pane-tree.ts';
import { useLayoutPersistence } from './useLayoutPersistence.ts';

// ── Pane state context（active tab 的衍生視圖）──

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
  /**
   * 分割 pane（預設 focused；paneId 指定目標）並回傳新 leaf id——分割後自動開
   * picker（handoff「分割（開 picker 選內容）」）需要它。無目標可分割時回 null。
   */
  splitPane: (direction: 'h' | 'v', paneId?: string) => string | null;
  splitPaneAndAssign: (direction: 'h' | 'v', sessionId: string, cwd: string | null) => void;
  /** 分割 focused pane 並在新半邊放入任意 content（picker ⌘⏎ 分割開啟） */
  splitPaneAndSetContent: (direction: 'h' | 'v', content: PaneContent) => void;
  /** 標準工作組（picker ⌘1）：focused pane 右側建 files/git 直欄，focus 留在原 pane */
  openToolColumn: (cwd: string) => void;
  /** DnD 方向落點（handoff §7）：source 移到 target 的某一側（樹收斂＋split 放入） */
  movePane: (sourceId: string, targetId: string, edge: DropEdge) => void;
  closePane: (paneId: string) => void;
  focusPane: (paneId: string) => void;
  updateRatio: (splitNodeId: string, ratio: number) => void;
  setSessionInPane: (paneId: string, sessionId: string | null, cwd: string | null) => void;
  setContentInPane: (paneId: string, content: PaneContent) => void;
  zoomPane: (paneId: string | null) => void;
  swapPane: (idA: string, idB: string) => void;
}

const PaneActionsContext: React.Context<PaneActionsValue | null> =
  createContext<PaneActionsValue | null>(null);

export function usePaneActions(): PaneActionsValue {
  const ctx = useContext(PaneActionsContext);
  if (!ctx) throw new Error('usePaneActions must be used within a TabProvider');
  return ctx;
}

// ── Workspace tab contexts ──

const WorkspaceTabStateContext: React.Context<WorkspaceTabStateValue | null> =
  createContext<WorkspaceTabStateValue | null>(null);

export function useWorkspaceTabState(): WorkspaceTabStateValue {
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

// Stable identity for the "active tab not found" edge — a fresh object per render
// would change leaf ids every render and remount the whole pane subtree.
// (applyLayout's membership guard makes this near-unreachable, but stay defensive.)
const FALLBACK_PANE_STATE: PaneStateValue = (() => {
  const leaf = makeLeaf();
  return { paneRoot: leaf, focusedPaneId: null, zoomedPaneId: null };
})();

export function WorkspaceLayoutProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [wsState, setWsState] = useState<WorkspaceTabStateValue>(() => {
    const initialWorkspaceTab = makeWorkspaceTab();
    return {
      workspaceTabs: [initialWorkspaceTab],
      activeWorkspaceTabId: initialWorkspaceTab.id,
    };
  });

  useLayoutPersistence(wsState, setWsState);

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
    splitPane: (direction, paneId) => {
      // 回傳值來自 setState updater 的同步（eager）求值——splitPane 必須是該
      // 事件裡此 state 的第一個 dispatch（PaneLeafBody 以 paneId 參數取代先
      // focusPane 再 split 的雙 dispatch）。無法同步求值時回 null（不開 picker）。
      let result: string | null = null;
      setWsState((prev) => ({
        ...prev,
        workspaceTabs: prev.workspaceTabs.map((t) => {
          if (t.id !== prev.activeWorkspaceTabId) return t;
          const { root: newRoot, newLeafId } = splitNode(
            t.paneRoot,
            paneId ?? t.focusedPaneId,
            direction,
          );
          result = newLeafId;
          return { ...t, paneRoot: newRoot, focusedPaneId: newLeafId ?? t.focusedPaneId };
        }),
      }));
      return result;
    },
    splitPaneAndAssign: (direction, sessionId, cwd) => {
      updateActiveTab((t) => {
        const { root: newRoot, newLeafId } = splitNodeAndAssign(
          t.paneRoot,
          t.focusedPaneId,
          direction,
          sessionId,
          cwd,
        );
        return { ...t, paneRoot: newRoot, focusedPaneId: newLeafId };
      });
    },
    splitPaneAndSetContent: (direction, content) => {
      updateActiveTab((t) => {
        const { root: split, newLeafId } = splitNode(t.paneRoot, t.focusedPaneId, direction);
        if (!newLeafId) return t;
        return {
          ...t,
          paneRoot: mapNode(split, (node) =>
            node.type === 'leaf' && node.id === newLeafId ? { ...node, content } : node,
          ),
          focusedPaneId: newLeafId,
        };
      });
    },
    movePane: (sourceId, targetId, edge) => {
      updateActiveTab((t) => {
        const next = movePaneTo(t.paneRoot, sourceId, targetId, edge);
        if (next === t.paneRoot) return t;
        return { ...t, paneRoot: next, focusedPaneId: sourceId ? targetId : t.focusedPaneId };
      });
    },
    openToolColumn: (cwd) => {
      updateActiveTab((t) => {
        const targetId =
          (t.focusedPaneId && hasLeaf(t.paneRoot, t.focusedPaneId) ? t.focusedPaneId : null) ??
          firstLeafId(t.paneRoot);
        if (!targetId) return t;
        const toolColumn: PaneNode = {
          type: 'split',
          id: crypto.randomUUID(),
          direction: 'v',
          ratio: 0.5,
          first: makeLeaf({ type: 'files', target: { kind: 'fixed', cwd } }),
          second: makeLeaf({ type: 'git', target: { kind: 'fixed', cwd } }),
        };
        return {
          ...t,
          paneRoot: mapNode(t.paneRoot, (node) =>
            node.type === 'leaf' && node.id === targetId
              ? {
                  type: 'split',
                  id: crypto.randomUUID(),
                  direction: 'h',
                  ratio: 0.6,
                  first: node,
                  second: toolColumn,
                }
              : node,
          ),
          focusedPaneId: targetId,
        };
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
    setSessionInPane: (paneId, sessionId, cwd) => {
      updateActiveTab((t) => ({
        ...t,
        paneRoot: mapNode(t.paneRoot, (node) =>
          node.type === 'leaf' && node.id === paneId
            ? { ...node, content: { type: 'session', sessionId, cwd } }
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
    swapPane: (idA, idB) => {
      updateActiveTab((t) => {
        function findContent(node: PaneNode, id: string): PaneContent | null {
          if (node.type === 'leaf') return node.id === id ? node.content : null;
          return findContent(node.first, id) ?? findContent(node.second, id);
        }
        const contentA = findContent(t.paneRoot, idA);
        const contentB = findContent(t.paneRoot, idB);
        if (!contentA || !contentB) return t;
        return {
          ...t,
          paneRoot: mapNode(t.paneRoot, (node) => {
            if (node.type === 'leaf') {
              if (node.id === idA) return { ...node, content: contentB };
              if (node.id === idB) return { ...node, content: contentA };
            }
            return node;
          }),
        };
      });
    },
  }));

  const activeWsTab = wsState.workspaceTabs.find((t) => t.id === wsState.activeWorkspaceTabId);
  const paneState: PaneStateValue = activeWsTab ?? FALLBACK_PANE_STATE;

  return (
    <WorkspaceTabStateContext.Provider value={wsState}>
      <WorkspaceTabActionsContext.Provider value={wsActions}>
        <PaneStateContext.Provider value={paneState}>
          <PaneActionsContext.Provider value={paneActions}>{children}</PaneActionsContext.Provider>
        </PaneStateContext.Provider>
      </WorkspaceTabActionsContext.Provider>
    </WorkspaceTabStateContext.Provider>
  );
}
