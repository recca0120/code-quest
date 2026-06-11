import { useEffect } from 'react';
import {
  findAncestorSplit,
  firstLeafId,
  leafIdsInOrder,
  type PaneNode,
  usePaneActions,
  usePaneState,
  useTabState,
} from '@/contexts/TabContext';
import { type FontSize, usePreferencesStore } from '@/stores/usePreferencesStore';
import { guardSplitMinSize } from './pane-min-size.ts';
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

function useKeyboardShortcuts(onOpenPicker?: (paneId?: string) => void): void {
  const { paneRoot, focusedPaneId, zoomedPaneId } = usePaneState();
  const { splitPane, closePane, focusPane, swapPane, zoomPane, updateRatio } = usePaneActions();
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

      // ⌘=/⌘-/⌘0 字級快捷鍵（preferences-axis-alignment §4c）
      if (meta && !e.shiftKey && !e.altKey) {
        const SIZES: FontSize[] = ['s', 'm', 'l', 'xl'];
        const { fontSize, setFontSize } = usePreferencesStore.getState();
        const idx = SIZES.indexOf(fontSize);
        const LABELS: Record<FontSize, string> = { s: 'S', m: 'M', l: 'L', xl: 'XL' };
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const next = SIZES[(idx + 1) % SIZES.length] ?? fontSize;
          setFontSize(next);
          window.dispatchEvent(new CustomEvent('font-size-hint', { detail: LABELS[next] }));
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          const next = SIZES[(idx - 1 + SIZES.length) % SIZES.length] ?? fontSize;
          setFontSize(next);
          window.dispatchEvent(new CustomEvent('font-size-hint', { detail: LABELS[next] }));
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          setFontSize('m');
          window.dispatchEvent(new CustomEvent('font-size-hint', { detail: LABELS.m }));
          return;
        }
      }

      // esc 解除 zoom（handoff §6）——drawer／dialog 開著時讓位（它們自己吃 esc）
      if (e.key === 'Escape' && !meta && zoomedPaneId !== null) {
        const overlayOpen = document.querySelector(
          '[data-testid="workspace-drawer"], [role="dialog"]',
        );
        if (!overlayOpen) {
          e.preventDefault();
          zoomPane(null);
          return;
        }
      }

      // ⌥1–9：跳到先序第 N 個 pane（handoff 鍵盤協定）。用 e.code——
      // macOS ⌥+數字會產生特殊字元（¡™£…），e.key 不可靠
      if (!meta && e.altKey && !e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
        const leaves = leafIdsInOrder(paneRoot);
        const target = leaves[Number(e.code.slice(5)) - 1];
        if (target) {
          e.preventDefault();
          focusPane(target);
          return;
        }
      }

      // ⌥方向鍵：微調 focused pane 邊界（handoff §7；固定步進 5%）
      if (
        !meta &&
        e.altKey &&
        !e.shiftKey &&
        focusedPaneId &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
        const found = findAncestorSplit(paneRoot, focusedPaneId, horizontal ? 'h' : 'v');
        if (found) {
          e.preventDefault();
          const grow = e.key === 'ArrowRight' || e.key === 'ArrowDown';
          // first 邊長大＝ratio 增；focused 在 second 時方向反轉
          const delta = (grow ? 0.05 : -0.05) * (found.paneInFirst ? 1 : -1);
          updateRatio(found.splitId, Math.min(0.9, Math.max(0.1, found.ratio + delta)));
          return;
        }
      }

      if (!meta) return;

      if (e.key === 'k' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        onOpenPicker?.(focusedPaneId ?? undefined);
        return;
      }

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

      // ⌘D 垂直分割（左右排）／⌘⇧D 水平分割（上下排）——handoff 定案鍵位。
      // 分割成功後自動開 picker 選內容（target = 新 leaf）；min-size 拒絕時不開。
      if (!isMobile && (e.key === 'd' || e.key === 'D') && !e.altKey) {
        e.preventDefault();
        const direction = e.shiftKey ? 'v' : 'h';
        if (guardSplitMinSize(focusedPaneId, direction)) {
          const newLeafId = splitPane(direction);
          if (newLeafId) onOpenPicker?.(newLeafId);
        }
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
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [
    paneRoot,
    focusedPaneId,
    focusedLeafCwd,
    isMobile,
    splitPane,
    closePane,
    focusPane,
    createSessionInPane,
    swapPane,
    zoomPane,
    zoomedPaneId,
    onOpenPicker,
    updateRatio,
  ]);
}

/** 狀態列快捷鍵提示（handoff §1）——單一來源：必須與本 provider 的實際綁定同步。 */
export const WORKSPACE_SHORTCUT_HINTS = [
  { keys: '⌘K', label: 'picker' },
  { keys: '⌘D', label: 'split ⇄' },
  { keys: '⌘⇧D', label: 'split ⇵' },
  { keys: '⌘⇧Z', label: 'zoom' },
  { keys: '⌥1-9', label: 'jump' },
] as const;

export function KeyboardShortcutsProvider({
  children,
  onOpenPicker,
}: {
  children: React.ReactNode;
  /** ⌘K — 開 PanePicker（唯一內容入口，handoff §4） */
  onOpenPicker?: (paneId?: string) => void;
}): React.JSX.Element {
  useKeyboardShortcuts(onOpenPicker);
  return <>{children}</>;
}
