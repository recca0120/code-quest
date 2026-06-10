import { useEffect, useMemo, useState } from 'react';
import {
  firstLeafId,
  type PaneNode,
  usePaneActions,
  usePaneState,
  useTabState,
} from '@/contexts/TabContext';
import { SessionManager } from './SessionManager';
import { SessionManagerContext } from './SessionManagerContext';
import { useCreateSessionInPane } from './useCreateSessionInPane.ts';
import { useMobileMode } from './useMobileMode';

function findAdjacentLeafId(
  root: PaneNode,
  currentId: string,
  direction: 'left' | 'right' | 'up' | 'down',
): string | null {
  // Collect all leaves in order
  const leaves: string[] = [];
  function collect(node: PaneNode): void {
    if (node.type === 'leaf') {
      leaves.push(node.id);
      return;
    }
    collect(node.first);
    collect(node.second);
  }
  collect(root);
  const idx = leaves.indexOf(currentId);
  if (idx < 0) return null;
  if (direction === 'left' || direction === 'up') return leaves[idx - 1] ?? null;
  return leaves[idx + 1] ?? null;
}

function useKeyboardShortcuts(
  sessionManagerOpen: boolean,
  setSessionManagerOpen: (fn: (prev: boolean) => boolean) => void,
): void {
  const { paneRoot, focusedPaneId, zoomedPaneId } = usePaneState();
  const { splitPane, closePane, focusPane, swapPane, zoomPane } = usePaneActions();
  const { createSessionInPane } = useCreateSessionInPane();
  const { tabs } = useTabState();
  const isMobile = useMobileMode();

  const focusedLeafCwd = (() => {
    if (!focusedPaneId) return undefined;
    function findLeaf(node: PaneNode): Extract<PaneNode, { type: 'leaf' }> | null {
      if (node.type === 'leaf') return node.id === focusedPaneId ? node : null;
      return findLeaf(node.first) ?? findLeaf(node.second);
    }
    const leaf = findLeaf(paneRoot);
    if (!leaf) return undefined;
    if (leaf.content.type === 'session' && leaf.content.sessionId) {
      return tabs[leaf.content.sessionId]?.cwd ?? undefined;
    }
    if (
      leaf.content.type === 'git' ||
      leaf.content.type === 'files' ||
      leaf.content.type === 'openspec'
    ) {
      return leaf.content.target.cwd;
    }
    return undefined;
  })();

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (e.key === 't' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        // create+place（D6）：session 可見落 pane，不再掉進隱形 pool
        createSessionInPane(focusedLeafCwd ? { cwd: focusedLeafCwd } : undefined);
        return;
      }

      // ⌘⇧Z — toggle zoom on the focused pane (was PaneZoomProvider)
      if (e.shiftKey && e.key === 'Z' && !e.altKey) {
        e.preventDefault();
        if (zoomedPaneId !== null) {
          zoomPane(null);
        } else if (focusedPaneId) {
          zoomPane(focusedPaneId);
        }
        return;
      }

      if (e.key === 'w' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        if (paneRoot.type === 'split' && focusedPaneId) {
          closePane(focusedPaneId);
        }
        return;
      }

      if (!isMobile && e.key === '\\' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        splitPane('h');
        return;
      }

      if (!isMobile && e.key === '-' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        splitPane('v');
        return;
      }

      if (
        e.shiftKey &&
        (e.key === 'ArrowRight' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        e.preventDefault();
        if (!focusedPaneId) return;
        const dir =
          e.key === 'ArrowLeft'
            ? 'left'
            : e.key === 'ArrowRight'
              ? 'right'
              : e.key === 'ArrowUp'
                ? 'up'
                : 'down';
        const adjacentId = findAdjacentLeafId(paneRoot, focusedPaneId, dir);
        if (adjacentId) swapPane(focusedPaneId, adjacentId);
        return;
      }

      if (e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setSessionManagerOpen((prev) => !prev);
        return;
      }

      if (
        e.altKey &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        e.preventDefault();
        const dir =
          e.key === 'ArrowLeft'
            ? 'left'
            : e.key === 'ArrowRight'
              ? 'right'
              : e.key === 'ArrowUp'
                ? 'up'
                : 'down';
        const targetId = focusedPaneId
          ? findAdjacentLeafId(paneRoot, focusedPaneId, dir)
          : firstLeafId(paneRoot);
        if (targetId) focusPane(targetId);
      }
    }

    function escapeHandler(e: KeyboardEvent): void {
      if (e.key === 'Escape' && sessionManagerOpen) {
        setSessionManagerOpen(() => false);
      }
    }

    document.addEventListener('keydown', handler);
    document.addEventListener('keydown', escapeHandler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('keydown', escapeHandler);
    };
  }, [
    paneRoot,
    focusedPaneId,
    focusedLeafCwd,
    isMobile,
    sessionManagerOpen,
    splitPane,
    closePane,
    focusPane,
    createSessionInPane,
    swapPane,
    zoomPane,
    zoomedPaneId,
    setSessionManagerOpen,
  ]);
}

/** 狀態列快捷鍵提示（handoff §1）——單一來源：必須與本 provider 的實際綁定同步。
 * ⌘K picker 於 P2 綁定後加項。 */
export const WORKSPACE_SHORTCUT_HINTS = [
  { keys: '⌘\\', label: 'split ⇄' },
  { keys: '⌘-', label: 'split ⇵' },
  { keys: '⌘⇧Z', label: 'zoom' },
  { keys: '⌘⇧M', label: 'sessions' },
] as const;

export function KeyboardShortcutsProvider({
  children,
  onNewSession,
  onNewWorktree,
  onAddProject,
}: {
  children: React.ReactNode;
  onNewSession?: (cwd: string, projectCwd: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
  onAddProject?: () => void;
}): React.JSX.Element {
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  useKeyboardShortcuts(sessionManagerOpen, setSessionManagerOpen);
  const ctxValue = useMemo(() => ({ open: () => setSessionManagerOpen(() => true) }), []);
  return (
    <SessionManagerContext.Provider value={ctxValue}>
      {children}
      {sessionManagerOpen && (
        <SessionManager
          onClose={() => setSessionManagerOpen(() => false)}
          onNewSession={(cwd, projectCwd) => {
            setSessionManagerOpen(() => false);
            onNewSession?.(cwd, projectCwd);
          }}
          onNewWorktree={(projectCwd) => {
            setSessionManagerOpen(() => false);
            onNewWorktree?.(projectCwd);
          }}
          onAddProject={() => {
            setSessionManagerOpen(() => false);
            onAddProject?.();
          }}
        />
      )}
    </SessionManagerContext.Provider>
  );
}
