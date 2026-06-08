import { useEffect, useState } from 'react';
import {
  firstLeafId,
  type PaneNode,
  usePaneActions,
  usePaneState,
  useTabActions,
} from '@/contexts/TabContext';
import { SessionManager } from './SessionManager';
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
  const { paneRoot, focusedPaneId } = usePaneState();
  const { splitPane, closePane, focusPane, swapPane } = usePaneActions();
  const { createNewTab } = useTabActions();
  const isMobile = useMobileMode();

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (e.key === 't' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        createNewTab();
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
    isMobile,
    sessionManagerOpen,
    splitPane,
    closePane,
    focusPane,
    createNewTab,
    swapPane,
    setSessionManagerOpen,
  ]);
}

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);
  useKeyboardShortcuts(sessionManagerOpen, setSessionManagerOpen);
  return (
    <>
      {children}
      {sessionManagerOpen && <SessionManager onClose={() => setSessionManagerOpen(() => false)} />}
    </>
  );
}
