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
} from '@/contexts/TabContext';
import { PaneTree } from './PaneTree.tsx';
import { PaneZoomProvider } from './PaneZoomProvider.tsx';
import { type PaneEnvironment, PaneEnvironmentProvider } from './panes/PaneEnvironmentContext.tsx';
import { SessionPool } from './panes/SessionPool.tsx';
import { SessionBar } from './SessionBar.tsx';
import { useAvailableWorktrees } from './useAvailableWorktrees.ts';
import { WorkspaceTabBar } from './WorkspaceTabBar.tsx';

function findPaneLeaf(node: PaneNode, id: string): Extract<PaneNode, { type: 'leaf' }> | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findPaneLeaf(node.first, id) ?? findPaneLeaf(node.second, id);
}

function findFirstLeaf(node: PaneNode): Extract<PaneNode, { type: 'leaf' }> | null {
  if (node.type === 'leaf') return node;
  return findFirstLeaf(node.first) ?? findFirstLeaf(node.second);
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
      const target = effectivePaneId
        ? (findPaneLeaf(paneRoot, effectivePaneId) ?? findFirstLeaf(paneRoot))
        : findFirstLeaf(paneRoot);
      if (target && target.content.type === 'session') {
        if (target.content.sessionId === null) {
          setSessionInPane(target.id, channelId, newCwd);
          focusPane(target.id);
        } else {
          // Pane is occupied — split and assign to new leaf to prevent double-mount
          splitPaneAndAssign('h', channelId, newCwd);
        }
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

  if (tabEntries.length === 0) {
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
    <PaneZoomProvider>
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
    </PaneZoomProvider>
  );
});
