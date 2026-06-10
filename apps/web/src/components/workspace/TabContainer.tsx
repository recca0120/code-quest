import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Approximate width of one session tab item (px) — used to compute maxVisible
const SESSION_TAB_WIDTH_PX = 120;

import { EmptyState } from '@/components/ui/EmptyState';
import { useNavigationActions } from '@/contexts/NavigationContext';
import { useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import {
  type PaneNode,
  usePaneActions,
  usePaneState,
  useTabActions,
  useTabState,
  useWorkspaceTab,
} from '@/contexts/TabContext';
import { PaneTree } from './PaneTree.tsx';
import { type PaneEnvironment, PaneEnvironmentProvider } from './panes/PaneEnvironmentContext.tsx';
import { SessionPool } from './panes/SessionPool.tsx';
import { SessionBar } from './SessionBar.tsx';
import { useAvailableWorktrees } from './useAvailableWorktrees.ts';
import { WorkspaceTabBar } from './WorkspaceTabBar.tsx';

type PaneLeafNode = Extract<PaneNode, { type: 'leaf' }>;

function findLeafBy(node: PaneNode, pred: (leaf: PaneLeafNode) => boolean): PaneLeafNode | null {
  if (node.type === 'leaf') return pred(node) ? node : null;
  return findLeafBy(node.first, pred) ?? findLeafBy(node.second, pred);
}

function findPaneLeaf(node: PaneNode, id: string): PaneLeafNode | null {
  return findLeafBy(node, (leaf) => leaf.id === id);
}

function isEmptySessionLeaf(leaf: PaneLeafNode): boolean {
  return leaf.content.type === 'session' && leaf.content.sessionId === null;
}

function isSessionLeaf(leaf: PaneLeafNode): boolean {
  return leaf.content.type === 'session';
}

interface TabContainerProps {
  onToggleLeft?: () => void;
  pendingNewSessionCwd?: string | null;
  onSessionCreated?: () => void;
  onOpenModal?: (paneId?: string) => void;
  onOpenSettings?: () => void;
  onAddProject?: () => void;
  onNewWorktree?: (projectCwd: string) => void;
}

export const TabContainer: React.FC<TabContainerProps> = memo(function TabContainer({
  onToggleLeft,
  pendingNewSessionCwd,
  onSessionCreated,
  onOpenModal,
  onOpenSettings,
  onAddProject,
  onNewWorktree,
}) {
  const { tabs } = useTabState();
  const { createNewTab, removeTab } = useTabActions();
  const { closeSession } = useSession();
  const { setActiveCwd } = useNavigationActions();

  const { activeProjectCwd, projects } = useProjectState();
  const { paneRoot, focusedPaneId } = usePaneState();
  const { workspaceTabs } = useWorkspaceTab();
  const { setSessionInPane, focusPane, splitPaneAndAssign } = usePaneActions();

  const focusedLeaf = focusedPaneId ? findPaneLeaf(paneRoot, focusedPaneId) : null;
  const focusedTabCwd = (() => {
    if (!focusedLeaf) return null;
    const c = focusedLeaf.content;
    if (c.type === 'session') return c.sessionId ? (tabs[c.sessionId]?.cwd ?? null) : null;
    if (c.type === 'git' || c.type === 'files' || c.type === 'openspec') return c.target.cwd;
    return null;
  })();

  // Create a new tab and immediately assign it to the focused pane (or first empty leaf)
  // Both updates are dispatched in the same event handler → React 18 batches them into one render
  // This avoids the double-mount "Channel already exists" error from useEffect-based assignment
  const handleCreateTab = useCallback(
    (opts?: { cwd?: string; targetPaneId?: string }) => {
      const { channelId, cwd: newCwd } = createNewTab(opts);
      const effectivePaneId = opts?.targetPaneId ?? focusedPaneId;
      const byId = effectivePaneId ? findPaneLeaf(paneRoot, effectivePaneId) : null;
      // Fallback chain: explicit session leaf → first EMPTY session leaf →
      // first session leaf → split. A created session must always land in a
      // pane — even when the focused pane is a tool pane (worktrees/git/…).
      const target =
        byId && isSessionLeaf(byId)
          ? byId
          : (findLeafBy(paneRoot, isEmptySessionLeaf) ?? findLeafBy(paneRoot, isSessionLeaf));
      if (target && target.content.type === 'session' && target.content.sessionId === null) {
        setSessionInPane(target.id, channelId, newCwd);
        focusPane(target.id);
      } else {
        // Occupied or no session leaf at all — split and assign to a new leaf
        splitPaneAndAssign('h', channelId, newCwd);
      }
    },
    // opts.targetPaneId is captured at call time — no need in deps
    [createNewTab, focusedPaneId, paneRoot, setSessionInPane, focusPane, splitPaneAndAssign],
  );

  // Keep a ref to the latest handleCreateTab to avoid stale closure in the effect
  const handleCreateTabRef = useRef(handleCreateTab);
  handleCreateTabRef.current = handleCreateTab;

  useEffect(() => {
    if (!pendingNewSessionCwd) return;
    handleCreateTabRef.current({ cwd: pendingNewSessionCwd });
    onSessionCreated?.();
  }, [pendingNewSessionCwd, onSessionCreated]);

  const handleCloseSession = useCallback(
    (channelId: string) => {
      closeSession(channelId);
      removeTab(channelId);
    },
    [closeSession, removeTab],
  );

  useEffect(() => {
    if (!activeProjectCwd) return;
    setActiveCwd(focusedTabCwd);
  }, [activeProjectCwd, focusedTabCwd, setActiveCwd]);

  useEffect(() => {
    if (!activeProjectCwd) return;
    return () => {
      setActiveCwd(null);
    };
  }, [activeProjectCwd, setActiveCwd]);

  const tabEntries = Object.entries(tabs);

  // Measure session bar container width to compute maxVisible
  const sessionBarContainerRef = useRef<HTMLDivElement>(null);
  const [sessionBarWidth, setSessionBarWidth] = useState(0);
  useEffect(() => {
    const el = sessionBarContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSessionBarWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const maxVisible =
    sessionBarWidth > 0
      ? Math.max(1, Math.floor((sessionBarWidth - SESSION_TAB_WIDTH_PX) / SESSION_TAB_WIDTH_PX))
      : undefined;

  const availableWorktrees = useAvailableWorktrees();

  // Stable-identity environment for pane bodies and pools — onNewTab reads the
  // latest handleCreateTab through a ref so ratio drags / tabs ticks never churn it
  const paneEnvironment = useMemo<PaneEnvironment>(
    () => ({
      onToggleLeft,
      onNewTab: (opts) => handleCreateTabRef.current(opts),
      onOpenModal,
      onNewWorktree,
    }),
    [onToggleLeft, onOpenModal, onNewWorktree],
  );

  // Global empty state only when the layout itself is the pristine default —
  // a restored layout of pure tool panes (git/worktrees) must render even with
  // zero session tabs (e.g. after server restart killed all sessions)
  const isDefaultEmptyLayout = workspaceTabs.every(
    (t) =>
      t.paneRoot.type === 'leaf' &&
      t.paneRoot.content.type === 'session' &&
      t.paneRoot.content.sessionId === null,
  );

  if (tabEntries.length === 0 && isDefaultEmptyLayout) {
    return (
      <EmptyState
        icon={<ChatBubbleLeftRightIcon className="w-10 h-10" />}
        message="No open sessions"
        actionLabel="New Session"
        onAction={onOpenModal ? () => onOpenModal(undefined) : () => handleCreateTab()}
      />
    );
  }

  const sessionBarItems = tabEntries.map(([id, meta]) => ({
    channelId: id,
    title: meta.title,
    tabStatus: meta.tabStatus,
    branch: meta.branch,
    cwd: meta.cwd ?? null,
  }));

  return (
    <div data-testid="tab-container" className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <WorkspaceTabBar onOpenSettings={onOpenSettings} onAddProject={onAddProject} />
      <div ref={sessionBarContainerRef} className="contents">
        <SessionBar
          sessions={sessionBarItems}
          maxVisible={maxVisible}
          availableWorktrees={availableWorktrees}
          projects={projects.map((p) => ({ cwd: p.cwd, name: p.name }))}
          onNewSession={(cwd) => handleCreateTab({ cwd })}
          onNewWorktree={onNewWorktree}
          onCloseSession={handleCloseSession}
        />
      </div>

      <PaneEnvironmentProvider value={paneEnvironment}>
        {/* Hidden mounts: inactive-tab sessions + unassigned pool (anti-double-mount) */}
        <SessionPool />

        {/* Pane area: sessions assigned to panes render here */}
        <PaneTree />
      </PaneEnvironmentProvider>
    </div>
  );
});
