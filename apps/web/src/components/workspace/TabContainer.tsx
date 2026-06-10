import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { useNavigationActions } from '@/contexts/NavigationContext';
import { useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import {
  type PaneNode,
  usePaneState,
  useTabActions,
  useTabState,
  useWorkspaceTabState,
} from '@/contexts/TabContext';
import { PaneTree } from './PaneTree.tsx';
import { type PaneEnvironment, PaneEnvironmentProvider } from './panes/PaneEnvironmentContext.tsx';
import { SessionPool } from './panes/SessionPool.tsx';
import { SessionBar } from './SessionBar.tsx';
import { useAvailableWorktrees, useWorktreeLookup } from './useAvailableWorktrees.ts';
import { useCreateSessionInPane } from './useCreateSessionInPane.ts';
import { WorkspaceTabBar } from './WorkspaceTabBar.tsx';

type PaneLeafNode = Extract<PaneNode, { type: 'leaf' }>;

function findPaneLeaf(node: PaneNode, id: string): PaneLeafNode | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findPaneLeaf(node.first, id) ?? findPaneLeaf(node.second, id);
}

interface PendingNewSession {
  cwd: string;
  projectCwd?: string;
  branch?: string;
  targetPaneId?: string;
}

interface TabContainerProps {
  onToggleLeft?: () => void;
  pendingNewSession?: PendingNewSession | null;
  onSessionCreated?: () => void;
  onOpenModal?: (paneId?: string) => void;
  onOpenSettings?: () => void;
  onAddProject?: () => void;
  onNewWorktree?: (projectCwd: string) => void;
}

export const TabContainer: React.FC<TabContainerProps> = memo(function TabContainer({
  onToggleLeft,
  pendingNewSession,
  onSessionCreated,
  onOpenModal,
  onOpenSettings,
  onAddProject,
  onNewWorktree,
}) {
  const { tabs } = useTabState();
  const { removeTab } = useTabActions();
  const { closeSession } = useSession();
  const { setActiveCwd } = useNavigationActions();

  const { activeProjectCwd, projects } = useProjectState();
  const { paneRoot, focusedPaneId } = usePaneState();
  const { workspaceTabs } = useWorkspaceTabState();

  const focusedLeaf = focusedPaneId ? findPaneLeaf(paneRoot, focusedPaneId) : null;
  const focusedTabCwd = (() => {
    if (!focusedLeaf) return null;
    const c = focusedLeaf.content;
    if (c.type === 'session') return c.sessionId ? (tabs[c.sessionId]?.cwd ?? null) : null;
    if (c.type === 'git' || c.type === 'files' || c.type === 'openspec') return c.target.cwd;
    return null;
  })();

  // create+place 收斂於 useCreateSessionInPane（worktree-centric D6）
  const { createSessionInPane } = useCreateSessionInPane();
  const handleCreateTab = useCallback(
    (opts?: { cwd?: string; projectCwd?: string; branch?: string; targetPaneId?: string }) => {
      createSessionInPane(opts);
    },
    [createSessionInPane],
  );

  // Keep a ref to the latest handleCreateTab to avoid stale closure in the effect
  const handleCreateTabRef = useRef(handleCreateTab);
  handleCreateTabRef.current = handleCreateTab;

  useEffect(() => {
    if (!pendingNewSession) return;
    handleCreateTabRef.current(pendingNewSession);
    onSessionCreated?.();
  }, [pendingNewSession, onSessionCreated]);

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

  const availableWorktrees = useAvailableWorktrees();
  const worktreeLookup = useWorktreeLookup();

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
    // live lookup first — branch renames reflect without reopening the session
    branch: (meta.cwd ? worktreeLookup.get(meta.cwd)?.branch : undefined) ?? meta.branch,
    cwd: meta.cwd ?? null,
  }));

  return (
    <div data-testid="tab-container" className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <WorkspaceTabBar onOpenSettings={onOpenSettings} onAddProject={onAddProject} />
      <SessionBar
        sessions={sessionBarItems}
        availableWorktrees={availableWorktrees}
        projects={projects.map((p) => ({ cwd: p.cwd, name: p.name }))}
        onNewSession={(cwd, projectCwd, branch) => handleCreateTab({ cwd, projectCwd, branch })}
        onNewWorktree={onNewWorktree}
        onCloseSession={handleCloseSession}
      />

      <PaneEnvironmentProvider value={paneEnvironment}>
        {/* Hidden mounts: inactive-tab sessions + unassigned pool (anti-double-mount) */}
        <SessionPool />

        {/* Pane area: sessions assigned to panes render here */}
        <PaneTree />
      </PaneEnvironmentProvider>
    </div>
  );
});
