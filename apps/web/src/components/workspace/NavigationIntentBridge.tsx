/**
 * Consumes NavigationContext intents with full create+place semantics
 * (worktree-centric 2.6). Moved out of TabProvider so intent-spawned sessions
 * land visibly in panes instead of the hidden pool, and activated channels get
 * placed when not already in a pane.
 */
import { useContext, useEffect } from 'react';
import { NavigationActionsContext, NavigationStateContext } from '@/contexts/NavigationContext';
import { useTabActions, useTabState } from '@/contexts/TabContext';
import { useCreateSessionInPane } from './useCreateSessionInPane.ts';

export function NavigationIntentBridge(): null {
  const navState = useContext(NavigationStateContext);
  const navActions = useContext(NavigationActionsContext);
  const { tabs } = useTabState();
  const { setActiveTab } = useTabActions();
  const { createSessionInPane, placeExistingSession } = useCreateSessionInPane();

  // Activate a channel once it appears in tabs (sessions effect may add it
  // later — the tabs dep re-runs this effect). Also PLACE it: an activated
  // channel not in any pane would otherwise be invisible.
  const pendingActivateChannel = navState?.pendingActivateChannel ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: actions/bridge fns are stable or derived from tabs/paneRoot which are deps via the hooks
  useEffect(() => {
    if (!pendingActivateChannel || !navActions) return;
    const { channelId } = pendingActivateChannel;
    if (!(channelId in tabs)) return;
    setActiveTab(channelId);
    placeExistingSession(channelId, tabs[channelId]?.cwd ?? null);
    navActions.clearPendingActivate();
  }, [pendingActivateChannel, tabs]);

  // Open-or-switch for a worktree row click; forceNew bypasses switch.
  const pendingOpenWorktree = navState?.pendingOpenWorktree ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: same reasoning as above
  useEffect(() => {
    if (!pendingOpenWorktree || !navActions) return;
    const existingId = pendingOpenWorktree.forceNew
      ? undefined
      : Object.entries(tabs).find(([, meta]) => meta.cwd === pendingOpenWorktree.worktreeCwd)?.[0];
    if (existingId) {
      setActiveTab(existingId);
      placeExistingSession(existingId, tabs[existingId]?.cwd ?? null);
    } else {
      // create+place — never the hidden pool (was the ghost-session path)
      createSessionInPane({ cwd: pendingOpenWorktree.worktreeCwd });
    }
    navActions.clearPendingOpenWorktree();
  }, [pendingOpenWorktree, tabs]);

  return null;
}
