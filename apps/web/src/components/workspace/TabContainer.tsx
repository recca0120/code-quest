import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Approximate width of one session tab item (px) — used to compute maxVisible
const SESSION_TAB_WIDTH_PX = 120;

const NOOP = (): void => {};

import { EmptyState } from '@/components/ui/EmptyState';
import { ChannelProvider } from '@/contexts/channel';
import { useGitState } from '@/contexts/GitContext';
import { useNavigationActions } from '@/contexts/NavigationContext';
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
import { ChatView } from '../chat/ChatView.tsx';
import { PaneHeader } from './PaneHeader.tsx';
import { PaneZoomProvider } from './PaneZoomProvider.tsx';
import { RightPane } from './RightPane.tsx';
import { SessionBar } from './SessionBar.tsx';
import { SplitPane } from './SplitPane.tsx';
import { FilesPane, GitPane, SpecPane, type WorktreeOption, WorktreesPane } from './ToolPanes.tsx';
import { WorkspaceTabBar } from './WorkspaceTabBar.tsx';

interface TabContentProps extends Pick<TabMeta, 'cwd' | 'title' | 'mode' | 'branch'> {
  channelId: string;
  projectName: string;
  onToggleLeft?: () => void;
  onNewChannel?: (cwd: string) => void;
  rightPane?: React.ReactNode;
}

function TabContent({
  channelId,
  cwd,
  branch,
  title,
  projectName,
  mode,
  onToggleLeft,
  onNewChannel,
  rightPane,
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
        rightPane={rightPane}
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
  availableWorktrees?: WorktreeOption[];
  onToggleLeft?: () => void;
  onNewTab: (opts?: { cwd?: string; targetPaneId?: string }) => void;
  onOpenModal?: (paneId?: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
}

function PaneLeafContent({
  node,
  tabs,
  projectName,
  availableWorktrees,
  onToggleLeft,
  onNewTab,
  onOpenModal,
  onNewWorktree,
}: PaneLeafContentProps) {
  const { paneRoot } = usePaneState();
  const { splitPane, closePane, focusPane } = usePaneActions();
  const [activeTool, setActiveTool] = useState<'files' | 'git' | 'spec' | null>(null);

  const sessionId = node.content.type === 'session' ? node.content.sessionId : null;
  const meta = sessionId ? tabs[sessionId] : null;
  const isOnly = paneRoot.type === 'leaf';

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <PaneHeader
        paneId={node.id}
        branch={meta?.branch}
        title={meta?.title}
        cwd={meta?.cwd}
        isOnly={isOnly}
        activeTool={activeTool}
        onToolSelect={setActiveTool}
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
        <GitPane cwd={node.content.cwd} paneId={node.id} availableWorktrees={availableWorktrees} />
      ) : node.content.type === 'files' ? (
        <FilesPane
          cwd={node.content.cwd}
          paneId={node.id}
          availableWorktrees={availableWorktrees}
        />
      ) : node.content.type === 'spec' ? (
        <SpecPane cwd={node.content.cwd} paneId={node.id} availableWorktrees={availableWorktrees} />
      ) : node.content.type === 'worktrees' ? (
        <WorktreesPane
          sessions={Object.entries(tabs).map(([id, m]) => ({
            channelId: id,
            cwd: m.cwd ?? '',
            title: m.title,
          }))}
          onNewSession={(cwd) => onNewTab({ cwd })}
          onNewWorktree={onNewWorktree}
        />
      ) : sessionId && meta ? (
        <TabContent
          channelId={sessionId}
          cwd={meta.cwd}
          branch={meta.branch}
          title={meta.title}
          projectName={projectName}
          mode={meta.mode}
          onToggleLeft={onToggleLeft}
          onNewChannel={(newCwd) => onNewTab({ cwd: newCwd })}
          rightPane={
            activeTool && meta.cwd ? (
              <RightPane key={activeTool} cwd={meta.cwd} initialTab={activeTool} />
            ) : undefined
          }
        />
      ) : (
        <EmptyState
          data-testid="empty-pane"
          icon={<ChatBubbleLeftRightIcon className="w-10 h-10" />}
          message="Empty pane"
          actionLabel="New Session"
          onAction={onOpenModal ? () => onOpenModal(node.id) : () => onNewTab()}
        />
      )}
    </div>
  );
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
  const { listing } = useGitState();
  const { paneRoot, focusedPaneId } = usePaneState();
  const { setSessionInPane, focusPane, splitPaneAndAssign } = usePaneActions();
  const { workspaceTabs, activeWorkspaceTabId } = useWorkspaceTab();

  const projectName = projects.find((p) => p.cwd === activeProjectCwd)?.name ?? '';

  const focusedLeaf = focusedPaneId ? findPaneLeaf(paneRoot, focusedPaneId) : null;
  const focusedTabCwd = (() => {
    if (!focusedLeaf) return null;
    const c = focusedLeaf.content;
    if (c.type === 'session') return c.sessionId ? (tabs[c.sessionId]?.cwd ?? null) : null;
    if ('cwd' in c) return (c as { cwd: string }).cwd;
    return null;
  })();

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

  // Sessions in INACTIVE workspace tabs' pane trees — must stay mounted to avoid double-mount
  // when switching tabs (React would unmount from pane and remount in pool simultaneously)
  const inactiveTabSessionIds = useMemo(
    () =>
      workspaceTabs
        .filter((t) => t.id !== activeWorkspaceTabId)
        .flatMap((t) => [...collectSessionsInPaneTree(t.paneRoot)]),
    [workspaceTabs, activeWorkspaceTabId],
  );

  const availableWorktrees = useMemo<WorktreeOption[]>(() => {
    return projects.flatMap((p) => {
      const wts = listing[p.cwd];
      if (!Array.isArray(wts)) return [];
      return wts.map((wt) => ({
        path: wt.path,
        branch: wt.branch,
        name: wt.name,
        projectName: p.name,
      }));
    });
  }, [projects, listing]);

  const renderLeaf = useCallback(
    (node: PaneNode) =>
      node.type === 'leaf' ? (
        <PaneLeafContent
          node={node}
          tabs={tabs}
          projectName={projectName}
          availableWorktrees={availableWorktrees}
          onToggleLeft={onToggleLeft}
          onNewTab={handleCreateTab}
          onOpenModal={onOpenModal}
          onNewWorktree={onNewWorktree}
        />
      ) : null,
    [
      tabs,
      projectName,
      availableWorktrees,
      onToggleLeft,
      handleCreateTab,
      onOpenModal,
      onNewWorktree,
    ],
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

  const sessionsInPanes = collectSessionsInPaneTree(paneRoot);

  // Sessions not in the ACTIVE tab's pane tree AND not in any inactive tab's pane tree
  const allPaneSessions = new Set([...sessionsInPanes, ...inactiveTabSessionIds]);

  const sessionBarItems = tabEntries.map(([id, meta]) => ({
    channelId: id,
    title: meta.title,
    tabStatus: meta.tabStatus,
    branch: meta.branch,
  }));

  return (
    <PaneZoomProvider>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
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
                onToggleLeft={onToggleLeft}
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
