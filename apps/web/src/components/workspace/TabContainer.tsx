import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { useNavigationActions } from '@/contexts/NavigationContext';
import { useProjectState } from '@/contexts/ProjectContext';
import {
  type PaneNode,
  usePaneState,
  useTabState,
  useWorkspaceTabState,
} from '@/contexts/TabContext';
import { CondensedPaneStrip } from './CondensedPaneStrip.tsx';
import { MobilePaneWall } from './MobilePaneWall.tsx';
import { PaneTree } from './PaneTree.tsx';
import { type PaneEnvironment, PaneEnvironmentProvider } from './panes/PaneEnvironmentContext.tsx';
import { SessionPool } from './panes/SessionPool.tsx';
import { useCreateSessionInPane } from './useCreateSessionInPane.ts';
import { WorkspaceStatusline } from './WorkspaceStatusline.tsx';
import { WorkspaceTabBar } from './WorkspaceTabBar.tsx';
import { ZoomBar } from './ZoomBar.tsx';

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
  pendingNewSession?: PendingNewSession | null;
  onSessionCreated?: () => void;
  onOpenModal?: (paneId?: string) => void;
  onOpenSettings?: () => void;
  onAddProject?: () => void;
  onNewWorktree?: (projectCwd: string) => void;
}

export const TabContainer: React.FC<TabContainerProps> = memo(function TabContainer({
  pendingNewSession,
  onSessionCreated,
  onOpenModal,
  onOpenSettings,
  onAddProject,
  onNewWorktree,
}) {
  const { tabs } = useTabState();
  const { setActiveCwd } = useNavigationActions();

  const { activeProjectCwd } = useProjectState();
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

  // Stable-identity environment for pane bodies and pools — onNewTab reads the
  // latest handleCreateTab through a ref so ratio drags / tabs ticks never churn it
  const paneEnvironment = useMemo<PaneEnvironment>(
    () => ({
      onNewTab: (opts) => handleCreateTabRef.current(opts),
      onOpenModal,
      onNewWorktree,
    }),
    [onOpenModal, onNewWorktree],
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

  return (
    <div data-testid="tab-container" className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <WorkspaceTabBar onOpenSettings={onOpenSettings} onAddProject={onAddProject} />
      <ZoomBar />
      <PaneEnvironmentProvider value={paneEnvironment}>
        {/* Hidden mounts: inactive-tab sessions + unassigned pool (anti-double-mount) */}
        <SessionPool />

        {/* Pane area: sessions assigned to panes render here */}
        <div className="flex flex-1 min-w-0 min-h-0">
          <PaneTree />
          <CondensedPaneStrip />
        </div>
        <MobilePaneWall />
      </PaneEnvironmentProvider>
      <WorkspaceStatusline />
    </div>
  );
});
