import { createContext, type ReactNode, useContext, useState } from 'react';

export function setMapEntry<T>(prev: Record<string, T>, key: string, value: T): Record<string, T> {
  return prev[key] === value ? prev : { ...prev, [key]: value };
}

/** Intent: tell the (global) TabProvider to activate `channelId` once it
 *  appears in its tabs. Set by flows that spawn a channel outside the
 *  provider (resume flow, dialogs). */
interface PendingActivateChannel {
  channelId: string;
}

/** Intent: open (or switch to) a tab whose cwd is `worktreeCwd` in the
 *  global TabProvider. `forceNew` bypasses switch-to-existing. */
interface PendingOpenWorktree {
  worktreeCwd: string;
  forceNew: boolean;
}

interface NavigationState {
  pendingActivateChannel: PendingActivateChannel | null;
  pendingOpenWorktree: PendingOpenWorktree | null;
  /** Sidebar's currently-selected worktree, per project. Drives:
   *  - TabProvider's createNewTab default cwd
   *  Selecting a worktree DOES NOT auto-open chat — user clicks `+` for that. */
  selectedWorktreeCwd: Record<string, string | null>;
  activeCwd: string | null;
  /** Last worktree the user visited per project — restored on project re-select. */
  lastWorktreeByProject: Record<string, string>;
  /** Last tab the user viewed per worktree — restored on worktree re-select. */
  lastTabByWorktree: Record<string, string>;
}

interface NavigationActions {
  requestActivateChannel: (channelId: string) => void;
  clearPendingActivate: () => void;
  requestOpenWorktree: (worktreeCwd: string, forceNew?: boolean) => void;
  clearPendingOpenWorktree: () => void;
  /** Set/clear which worktree the sidebar has highlighted under the given project. */
  setSelectedWorktree: (projectCwd: string, worktreeCwd: string | null) => void;
  setActiveCwd: (cwd: string | null) => void;
  recordLastWorktree: (projectCwd: string, worktreeCwd: string) => void;
  recordLastTab: (worktreeCwd: string, channelId: string) => void;
}

export const NavigationStateContext: React.Context<NavigationState | null> =
  createContext<NavigationState | null>(null);
export const NavigationActionsContext: React.Context<NavigationActions | null> =
  createContext<NavigationActions | null>(null);

export function useNavigationState(): NavigationState {
  const ctx = useContext(NavigationStateContext);
  if (!ctx) throw new Error('useNavigationState must be used within NavigationProvider');
  return ctx;
}

export function useNavigationActions(): NavigationActions {
  const ctx = useContext(NavigationActionsContext);
  if (!ctx) throw new Error('useNavigationActions must be used within NavigationProvider');
  return ctx;
}

export function NavigationProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [pendingActivateChannel, setPendingActivateChannel] =
    useState<PendingActivateChannel | null>(null);
  const [pendingOpenWorktree, setPendingOpenWorktree] = useState<PendingOpenWorktree | null>(null);
  const [selectedWorktreeCwd, setSelectedWorktreeCwdState] = useState<
    Record<string, string | null>
  >({});
  const [activeCwd, setActiveCwd] = useState<string | null>(null);
  const [lastWorktreeByProject, setLastWorktreeByProject] = useState<Record<string, string>>({});
  const [lastTabByWorktree, setLastTabByWorktree] = useState<Record<string, string>>({});

  const [actions] = useState<NavigationActions>(() => ({
    requestActivateChannel: (channelId) => setPendingActivateChannel({ channelId }),
    clearPendingActivate: () => setPendingActivateChannel(null),
    requestOpenWorktree: (worktreeCwd, forceNew = false) =>
      setPendingOpenWorktree({ worktreeCwd, forceNew }),
    clearPendingOpenWorktree: () => setPendingOpenWorktree(null),
    setActiveCwd,
    recordLastWorktree: (projectCwd, worktreeCwd) =>
      setLastWorktreeByProject((prev) => setMapEntry(prev, projectCwd, worktreeCwd)),
    recordLastTab: (worktreeCwd, channelId) =>
      setLastTabByWorktree((prev) => setMapEntry(prev, worktreeCwd, channelId)),
    setSelectedWorktree: (projectCwd, worktreeCwd) => {
      setSelectedWorktreeCwdState((prev) => {
        if (worktreeCwd === null) {
          if (!(projectCwd in prev)) return prev;
          const { [projectCwd]: _, ...rest } = prev;
          return rest;
        }
        if (prev[projectCwd] === worktreeCwd) return prev;
        return { ...prev, [projectCwd]: worktreeCwd };
      });
    },
  }));

  const state: NavigationState = {
    pendingActivateChannel,
    pendingOpenWorktree,
    selectedWorktreeCwd,
    activeCwd,
    lastWorktreeByProject,
    lastTabByWorktree,
  };

  return (
    <NavigationStateContext.Provider value={state}>
      <NavigationActionsContext.Provider value={actions}>
        {children}
      </NavigationActionsContext.Provider>
    </NavigationStateContext.Provider>
  );
}
