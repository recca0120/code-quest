import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const NOOP = (): void => {};

import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChannelProvider } from '@/contexts/channel';
import { useNavigationActions, useNavigationState } from '@/contexts/NavigationContext';
import { useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import {
  collectSessionsInPaneTree,
  type PaneNode,
  type TabMeta,
  usePaneActions,
  usePaneState,
  useTabActions,
  useTabState,
  useWorkspaceTab,
} from '@/contexts/TabContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { basename } from '@/utils/basename';
import { ChatView } from '../chat/ChatView.tsx';
import { EmptyPanePicker } from './EmptyPanePicker.tsx';
import { PaneHeader } from './PaneHeader.tsx';
import { PaneZoomProvider } from './PaneZoomProvider.tsx';
import { RightPane } from './RightPane.tsx';
import { SessionBar } from './SessionBar.tsx';
import { SplitPane } from './SplitPane.tsx';
import { FilesPane, GitPane, SpecPane, WorktreesPane } from './ToolPanes.tsx';
import { WorkspaceTabBar } from './WorkspaceTabBar.tsx';

interface TabContentProps extends Pick<TabMeta, 'cwd' | 'title' | 'mode' | 'branch'> {
  channelId: string;
  projectName: string;
  rightOpen: boolean;
  onToggleLeft?: () => void;
  onToggleRight: () => void;
  onNewChannel?: (cwd: string) => void;
}

function TabContent({
  channelId,
  cwd,
  branch,
  title,
  projectName,
  mode,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  onNewChannel,
}: TabContentProps) {
  const { setTabTitle, setTabStatus } = useTabActions();
  return (
    <ChannelProvider
      channelId={channelId}
      cwd={cwd}
      branch={branch}
      mode={mode}
      onChange={(update) => {
        if (update.title) setTabTitle(channelId, update.title);
        if (update.status) setTabStatus(channelId, update.status);
      }}
      onNewChannel={onNewChannel}
    >
      <ChatView
        title={title}
        projectName={projectName}
        onToggleLeft={onToggleLeft}
        onToggleRight={cwd ? onToggleRight : undefined}
        rightPane={
          cwd && rightOpen ? (
            <RightPane cwd={cwd} onMention={(path) => toast(`Mention queued: ${path}`)} />
          ) : null
        }
      />
    </ChannelProvider>
  );
}

function findPaneLeaf(node: PaneNode, id: string): Extract<PaneNode, { type: 'leaf' }> | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  return findPaneLeaf(node.first, id) ?? findPaneLeaf(node.second, id);
}

function findFirstLeaf(node: PaneNode): Extract<PaneNode, { type: 'leaf' }> | null {
  if (node.type === 'leaf') return node;
  return findFirstLeaf(node.first) ?? findFirstLeaf(node.second);
}

interface PaneLeafContentProps {
  node: Extract<PaneNode, { type: 'leaf' }>;
  tabs: Record<string, TabMeta>;
  projectName: string;
  rightOpen: boolean;
  onToggleLeft?: () => void;
  onToggleRight: () => void;
  onNewTab: (opts?: { cwd?: string; targetPaneId?: string }) => void;
}

function PaneLeafContent({
  node,
  tabs,
  projectName,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  onNewTab,
}: PaneLeafContentProps) {
  const { paneRoot } = usePaneState();
  const { splitPane, closePane, focusPane } = usePaneActions();

  const sessionId = node.content.type === 'session' ? node.content.sessionId : null;
  const meta = sessionId ? tabs[sessionId] : null;
  const isOnly = paneRoot.type === 'leaf';

  const sessionsInPanes = collectSessionsInPaneTree(paneRoot);
  const inactiveSessions = Object.entries(tabs)
    .filter(([id]) => !sessionsInPanes.has(id))
    .map(([id, m]) => ({ channelId: id, title: m.title }));

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <PaneHeader
        paneId={node.id}
        branch={meta?.branch}
        title={meta?.title}
        isOnly={isOnly}
        onSplitH={() => {
          focusPane(node.id);
          splitPane('h');
        }}
        onSplitV={() => {
          focusPane(node.id);
          splitPane('v');
        }}
        onClose={() => closePane(node.id)}
      />
      {node.content.type === 'git' ? (
        <GitPane
          cwd={node.content.cwd}
          paneId={node.id}
          availableCwds={Object.values(tabs)
            .map((m) => m.cwd)
            .filter((c): c is string => !!c)}
        />
      ) : node.content.type === 'files' ? (
        <FilesPane
          cwd={node.content.cwd}
          paneId={node.id}
          availableCwds={Object.values(tabs)
            .map((m) => m.cwd)
            .filter((c): c is string => !!c)}
        />
      ) : node.content.type === 'spec' ? (
        <SpecPane
          cwd={node.content.cwd}
          paneId={node.id}
          availableCwds={Object.values(tabs)
            .map((m) => m.cwd)
            .filter((c): c is string => !!c)}
        />
      ) : node.content.type === 'worktrees' ? (
        <WorktreesPane />
      ) : sessionId && meta ? (
        <TabContent
          channelId={sessionId}
          cwd={meta.cwd}
          branch={meta.branch}
          title={meta.title}
          projectName={projectName}
          mode={meta.mode}
          rightOpen={rightOpen}
          onToggleLeft={onToggleLeft}
          onToggleRight={onToggleRight}
          onNewChannel={(newCwd) => onNewTab({ cwd: newCwd })}
        />
      ) : (
        <EmptyPanePicker
          paneId={node.id}
          sessions={inactiveSessions}
          onNewSession={() => onNewTab({ targetPaneId: node.id })}
        />
      )}
    </div>
  );
}

interface TabContainerProps {
  projectCwd: string;
  onToggleLeft?: () => void;
  pendingNewSessionCwd?: string | null;
  onSessionCreated?: () => void;
}

export const TabContainer: React.FC<TabContainerProps> = memo(function TabContainer({
  projectCwd,
  onToggleLeft,
  pendingNewSessionCwd,
  onSessionCreated,
}) {
  const { tabs } = useTabState();
  const { createNewTab, removeTab } = useTabActions();
  const { closeSession } = useSession();
  const { setActiveCwd } = useNavigationActions();
  const { selectedWorktreeCwd } = useNavigationState();
  const { activeProjectCwd } = useProjectState();
  const { isDesktop } = useBreakpoint();
  const [rightOpen, setRightOpen] = useState(() => isDesktop);
  const toggleRight = useCallback(() => setRightOpen((v) => !v), []);
  const { paneRoot, focusedPaneId } = usePaneState();
  const { setSessionInPane, focusPane, splitPaneAndAssign } = usePaneActions();
  const { workspaceTabs, activeWorkspaceTabId } = useWorkspaceTab();

  const isThisActive = projectCwd === activeProjectCwd;
  const projectName = basename(projectCwd);

  const focusedLeaf = focusedPaneId ? findPaneLeaf(paneRoot, focusedPaneId) : null;
  const focusedSession =
    focusedLeaf?.content.type === 'session' ? focusedLeaf.content.sessionId : null;
  const focusedTabCwd = focusedSession ? (tabs[focusedSession]?.cwd ?? null) : null;

  // Create a new tab and immediately assign it to the focused pane (or first empty leaf)
  // Both updates are dispatched in the same event handler → React 18 batches them into one render
  // This avoids the double-mount "Channel already exists" error from useEffect-based assignment
  const handleCreateTab = useCallback(
    (opts?: { cwd?: string; targetPaneId?: string }) => {
      const { channelId } = createNewTab(opts);
      const effectivePaneId = opts?.targetPaneId ?? focusedPaneId;
      const target = effectivePaneId
        ? (findPaneLeaf(paneRoot, effectivePaneId) ?? findFirstLeaf(paneRoot))
        : findFirstLeaf(paneRoot);
      if (target && target.content.type === 'session') {
        if (target.content.sessionId === null) {
          setSessionInPane(target.id, channelId);
          focusPane(target.id);
        } else {
          // Pane is occupied — split and assign to new leaf to prevent double-mount
          splitPaneAndAssign('h', channelId);
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
    if (!isThisActive) return;
    setActiveCwd(focusedTabCwd);
  }, [isThisActive, focusedTabCwd, setActiveCwd]);

  useEffect(() => {
    if (!isThisActive) return;
    return () => {
      setActiveCwd(null);
    };
  }, [isThisActive, setActiveCwd]);

  const tabEntries = Object.entries(tabs);
  const worktreeFilter = selectedWorktreeCwd[projectCwd];

  // Sessions in INACTIVE workspace tabs' pane trees — must stay mounted to avoid double-mount
  // when switching tabs (React would unmount from pane and remount in pool simultaneously)
  const inactiveTabSessionIds = useMemo(
    () =>
      workspaceTabs
        .filter((t) => t.id !== activeWorkspaceTabId)
        .flatMap((t) => [...collectSessionsInPaneTree(t.paneRoot)]),
    [workspaceTabs, activeWorkspaceTabId],
  );

  const renderLeaf = useCallback(
    (node: PaneNode) =>
      node.type === 'leaf' ? (
        <PaneLeafContent
          node={node}
          tabs={tabs}
          projectName={projectName}
          rightOpen={rightOpen}
          onToggleLeft={onToggleLeft}
          onToggleRight={toggleRight}
          onNewTab={handleCreateTab}
        />
      ) : null,
    [tabs, projectName, rightOpen, onToggleLeft, toggleRight, handleCreateTab],
  );

  if (tabEntries.length === 0) {
    return (
      <EmptyState
        icon={<ChatBubbleLeftRightIcon className="w-10 h-10" />}
        message="No open sessions"
        actionLabel="New Session"
        onAction={() => handleCreateTab()}
      />
    );
  }

  const sessionsInPanes = collectSessionsInPaneTree(paneRoot);

  // Sessions not in the ACTIVE tab's pane tree AND not in any inactive tab's pane tree
  const allPaneSessions = new Set([...sessionsInPanes, ...inactiveTabSessionIds]);

  const sessionBarItems = tabEntries
    .filter(([, meta]) => !worktreeFilter || meta.cwd === worktreeFilter)
    .map(([id, meta]) => ({
      channelId: id,
      title: meta.title,
      tabStatus: meta.tabStatus,
      branch: meta.branch,
    }));

  return (
    <PaneZoomProvider>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <WorkspaceTabBar />
        <SessionBar
          sessions={sessionBarItems}
          onNewSession={() => handleCreateTab({ cwd: focusedTabCwd ?? undefined })}
          onCloseSession={handleCloseSession}
        />

        {/* Inactive workspace tabs: keep sessions in their pane trees mounted to prevent
              double-mount when switching tabs (avoids "Channel already exists" error) */}
        <div data-testid="inactive-tab-sessions" hidden aria-hidden="true">
          {inactiveTabSessionIds.map((id) => {
            const meta = tabs[id];
            if (!meta) return null;
            return (
              <TabContent
                key={id}
                channelId={id}
                cwd={meta.cwd}
                branch={meta.branch}
                title={meta.title}
                projectName={projectName}
                mode={meta.mode}
                rightOpen={false}
                onToggleRight={NOOP}
                onNewChannel={NOOP}
              />
            );
          })}
        </div>

        {/* Pool: sessions not assigned to any pane in any workspace tab */}
        <div data-testid="session-pool" hidden aria-hidden="true" style={{ display: 'none' }}>
          {tabEntries
            .filter(([id]) => !allPaneSessions.has(id))
            .map(([id, meta]) => (
              <TabContent
                key={id}
                channelId={id}
                cwd={meta.cwd}
                branch={meta.branch}
                title={meta.title}
                projectName={projectName}
                mode={meta.mode}
                rightOpen={rightOpen}
                onToggleLeft={onToggleLeft}
                onToggleRight={toggleRight}
                onNewChannel={(newCwd) => handleCreateTab({ cwd: newCwd })}
              />
            ))}
        </div>

        {/* SplitPane area: sessions assigned to panes render here */}
        <SplitPane renderLeaf={renderLeaf} />
      </div>
    </PaneZoomProvider>
  );
});
