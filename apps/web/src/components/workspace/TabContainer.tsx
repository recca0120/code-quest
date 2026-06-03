import type { WorktreeInfo } from '@code-quest/git';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import * as Tabs from '@radix-ui/react-tabs';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChannelProvider } from '@/contexts/channel';
import { useGitState } from '@/contexts/GitContext';
import { useNavigationActions } from '@/contexts/NavigationContext';
import { useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import { type TabMeta, useTabActions, useTabState } from '@/contexts/TabContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { basename } from '@/utils/basename';
import { cn } from '@/utils/cn';
import { ChatView } from '../chat/ChatView.tsx';
import { RightPane } from './RightPane.tsx';
import { TabBar } from './TabBar.tsx';

export function findWorktreeByCwd(
  listing: Record<string, WorktreeInfo[] | 'not_a_repo'>,
  cwd: string | undefined,
): { worktree: WorktreeInfo; projectCwd: string } | null {
  if (!cwd) return null;
  for (const [projectCwd, entry] of Object.entries(listing)) {
    if (!Array.isArray(entry)) continue;
    const match = entry.find((w) => w.path === cwd && w.path !== projectCwd);
    if (match) return { worktree: match, projectCwd };
  }
  return null;
}

interface TabContentProps extends Pick<TabMeta, 'cwd' | 'title' | 'mode'> {
  channelId: string;
  projectName: string;
  rightOpen: boolean;
  onToggleLeft?: () => void;
  onToggleRight: () => void;
}

function TabContent({
  channelId,
  cwd,
  title,
  projectName,
  mode,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: TabContentProps) {
  const { setTabTitle, setTabStatus, createNewTab } = useTabActions();
  return (
    <ChannelProvider
      channelId={channelId}
      cwd={cwd}
      mode={mode}
      onChange={(update) => {
        if (update.title) setTabTitle(channelId, update.title);
        if (update.status) setTabStatus(channelId, update.status);
      }}
      onNewChannel={(newCwd) => createNewTab({ cwd: newCwd })}
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

export const TabContainer: React.FC<{ projectCwd: string; onToggleLeft?: () => void }> = memo(
  function TabContainer({ projectCwd, onToggleLeft }) {
    const { activeTabId, tabs } = useTabState();
    const { setActiveTab, removeTab, createNewTab } = useTabActions();
    const { closeSession } = useSession();
    const { listing } = useGitState();
    const { setActiveCwd } = useNavigationActions();
    const { activeProjectCwd } = useProjectState();
    const { isDesktop } = useBreakpoint();
    const [rightOpen, setRightOpen] = useState(() => isDesktop);
    const toggleRight = useCallback(() => setRightOpen((v) => !v), []);

    const isThisActive = projectCwd === activeProjectCwd;
    const activeTabCwd = activeTabId ? (tabs[activeTabId]?.cwd ?? null) : null;
    const projectName = basename(projectCwd);

    useEffect(() => {
      if (!isThisActive) return;
      setActiveCwd(activeTabCwd);
    }, [isThisActive, activeTabCwd, setActiveCwd]);

    // Separate effect: cleanup on active→inactive must not depend on
    // activeTabCwd, otherwise switching tabs would flap to null then new cwd.
    useEffect(() => {
      if (!isThisActive) return;
      return () => {
        setActiveCwd(null);
      };
    }, [isThisActive, setActiveCwd]);

    const handleCloseTab = (id: string) => {
      closeSession(id);
      removeTab(id);
    };

    const tabEntries = Object.entries(tabs);
    const openTabs = tabEntries.map(([id, meta]) => {
      const found = findWorktreeByCwd(listing, meta.cwd);
      return {
        sessionId: id,
        title: meta.title,
        status: meta.tabStatus,
        worktree: found
          ? { name: found.worktree.name, path: found.worktree.path, branch: found.worktree.branch }
          : undefined,
        projectName: found ? basename(found.projectCwd) : undefined,
      };
    });

    if (tabEntries.length === 0) {
      return (
        <EmptyState
          icon={<ChatBubbleLeftRightIcon className="w-10 h-10" />}
          message="No open sessions"
          actionLabel="New Session"
          onAction={() => createNewTab()}
        />
      );
    }

    return (
      <Tabs.Root
        value={activeTabId ?? undefined}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-w-0"
        aria-label="tab-container-root"
      >
        <TabBar
          tabs={openTabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTab}
          onCloseTab={handleCloseTab}
          onNewTab={() => createNewTab()}
        />
        <div className="flex flex-1 overflow-hidden">
          {tabEntries.map(([id, meta]) => (
            <Tabs.Content
              key={id}
              value={id}
              forceMount
              hidden={id !== activeTabId}
              aria-label={id === activeTabId ? 'tab-container' : undefined}
              className={cn(id === activeTabId ? 'flex flex-1 min-w-0' : undefined)}
            >
              <TabContent
                channelId={id}
                cwd={meta.cwd}
                title={meta.title}
                projectName={projectName}
                mode={meta.mode}
                rightOpen={rightOpen}
                onToggleLeft={onToggleLeft}
                onToggleRight={toggleRight}
              />
            </Tabs.Content>
          ))}
        </div>
      </Tabs.Root>
    );
  },
);
