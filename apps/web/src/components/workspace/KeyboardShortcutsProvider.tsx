import { useEffect } from 'react';
import {
  firstLeafId,
  type PaneNode,
  usePaneActions,
  usePaneState,
  useTabActions,
} from '@/contexts/TabContext';

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

function useKeyboardShortcuts(): void {
  const { paneRoot, focusedPaneId } = usePaneState();
  const { splitPane, closePane, focusPane } = usePaneActions();
  const { createNewTab } = useTabActions();

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

      if (e.key === '\\' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        splitPane('h');
        return;
      }

      if (e.key === '-' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        splitPane('v');
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

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [paneRoot, focusedPaneId, splitPane, closePane, focusPane, createNewTab]);
}

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  useKeyboardShortcuts();
  return <>{children}</>;
}
