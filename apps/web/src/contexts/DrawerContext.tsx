import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { PaneContent } from './TabContext';

/**
 * 全域單例 drawer（handoff §5）：{ descriptor } | null，不 persist——
 * drawer 是暫態檢視，釘選（轉成 pane tree leaf）才進 layout。
 */
interface DrawerStateValue {
  drawer: { content: PaneContent } | null;
}

interface DrawerActionsValue {
  openDrawer: (content: PaneContent) => void;
  closeDrawer: () => void;
}

const DrawerStateContext: React.Context<DrawerStateValue | null> =
  createContext<DrawerStateValue | null>(null);
const DrawerActionsContext: React.Context<DrawerActionsValue | null> =
  createContext<DrawerActionsValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [drawer, setDrawer] = useState<{ content: PaneContent } | null>(null);
  const openDrawer = useCallback((content: PaneContent) => setDrawer({ content }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const state = useMemo(() => ({ drawer }), [drawer]);
  const actions = useMemo(() => ({ openDrawer, closeDrawer }), [openDrawer, closeDrawer]);
  return (
    <DrawerStateContext.Provider value={state}>
      <DrawerActionsContext.Provider value={actions}>{children}</DrawerActionsContext.Provider>
    </DrawerStateContext.Provider>
  );
}

export function useDrawerState(): DrawerStateValue {
  const ctx = useContext(DrawerStateContext);
  if (!ctx) throw new Error('useDrawerState must be used within a DrawerProvider');
  return ctx;
}

export function useDrawerActions(): DrawerActionsValue {
  const ctx = useContext(DrawerActionsContext);
  if (!ctx) throw new Error('useDrawerActions must be used within a DrawerProvider');
  return ctx;
}

/** soft-bound 版：drawer 是 workspace 級輔助服務——切片測試或無 drawer 的
 * 殼層下回傳 null，consumer 隱藏入口即可（⤢ 鈕不顯示）。 */
export function useDrawerActionsOptional(): DrawerActionsValue | null {
  return useContext(DrawerActionsContext);
}
