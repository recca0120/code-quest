import { useEffect, useState } from 'react';
import { leafIdsInOrder, usePaneState } from '@/contexts/TabContext';
import { useMobileMode } from './useMobileMode';

/** tablet 區間（768–1023）+ portrait：slide-over mode（handoff §8） */
export function useTabletPortraitMode(): boolean {
  const isTablet = useTabletMode();
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(orientation: portrait)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    setIsPortrait(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTablet && isPortrait;
}

/** tablet 區間（768–1023）：同時可見 pane 上限 2（handoff §8） */
export function useTabletMode(): boolean {
  const query = '(min-width: 768px) and (max-width: 1023px)';
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    setIsTablet(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTablet;
}

export interface VisiblePanes {
  /** null = 全部可見（desktop、無 zoom） */
  visible: Set<string> | null;
  /** 被收納（不渲染但 state/session 保活）的 leaf ids（先序） */
  condensed: string[];
}

/**
 * 「同時渲染哪些 pane」的單一來源（design D4）：zoom > RWD 上限 > 全部。
 * 收納完全衍生自 focused（零額外 state）——點直立條＝focusPane，
 * 回桌面時原樹自動還原；PaneTree 與 SessionPool（保活）共用本 hook。
 */
export function useVisiblePaneIds(): VisiblePanes {
  const { paneRoot, focusedPaneId, zoomedPaneId } = usePaneState();
  const isMobile = useMobileMode();
  const isTablet = useTabletMode();
  const isPortrait = useTabletPortraitMode();

  const leaves = leafIdsInOrder(paneRoot);
  if (zoomedPaneId && leaves.includes(zoomedPaneId)) {
    return { visible: new Set([zoomedPaneId]), condensed: [] };
  }
  if (isMobile) {
    const focus = focusedPaneId && leaves.includes(focusedPaneId) ? focusedPaneId : leaves[0];
    if (!focus) return { visible: null, condensed: [] };
    return { visible: new Set([focus]), condensed: leaves.filter((id) => id !== focus) };
  }
  if (isPortrait && leaves.length > 2) {
    const primaryId = leaves[0];
    if (!primaryId) return { visible: null, condensed: [] };
    const focusId = focusedPaneId && leaves.includes(focusedPaneId) ? focusedPaneId : primaryId;
    const visible = focusId === primaryId ? new Set([primaryId]) : new Set([primaryId, focusId]);
    return { visible, condensed: leaves.filter((id) => !visible.has(id)) };
  }
  if (isTablet && leaves.length > 2) {
    const focus = focusedPaneId && leaves.includes(focusedPaneId) ? focusedPaneId : leaves[0];
    if (!focus) return { visible: null, condensed: [] };
    const idx = leaves.indexOf(focus);
    const neighbor = leaves[idx + 1] ?? leaves[idx - 1];
    const visible = new Set(neighbor ? [focus, neighbor] : [focus]);
    return { visible, condensed: leaves.filter((id) => !visible.has(id)) };
  }
  return { visible: null, condensed: [] };
}
