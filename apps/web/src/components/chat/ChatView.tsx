import type { SessionSummary } from '@code-quest/schemas';
import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useChannelComposeActions, useChannelConfig, useChannelId } from '@/contexts/channel';
import { useNavigationActions } from '@/contexts/NavigationContext';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import { useTabActions } from '@/contexts/TabContext';
import { useChannelStore } from '@/stores/ChannelStoreContext';
import { NO_FORM } from '@/utils/hotkey-options';
import { resumeRoute } from '@/utils/resume-route';
import { ChannelOverlays } from './ChannelOverlays.tsx';
import { ChatBreadcrumb } from './ChatBreadcrumb.tsx';
import { ChatPanel } from './ChatPanel.tsx';
import { ChatInputArea } from './compose/ChatInputArea.tsx';
import { MessageList } from './conversation/MessageList.tsx';
import { ResumeButton } from './ResumeButton.tsx';
import { WorktreeBanner } from './WorktreeBanner.tsx';

interface ChatViewProps {
  title?: string;
  projectName?: string;
  onToggleLeft?: () => void;
}

export function ChatView({ title, projectName, onToggleLeft }: ChatViewProps): React.JSX.Element {
  const channelId = useChannelId();
  const messages = useChannelStore((s) => s.messages);
  const { worktree } = useChannelConfig();
  const { activeProjectCwd } = useProjectState();
  const { focusTextarea } = useChannelComposeActions();
  useHotkeys('/', focusTextarea, NO_FORM);
  const { setActiveProject } = useProjectActions();
  const { requestActivateChannel } = useNavigationActions();
  const { replaceTab } = useTabActions();
  const handleResumed = useCallback(
    (spawnedId: string, picked: SessionSummary) => {
      const route = resumeRoute({
        isEmpty: messages.length === 0,
        currentCwd: activeProjectCwd,
        currentChannelId: channelId,
        picked,
        spawnedChannelId: spawnedId,
      });
      if (route.type === 'replace') {
        replaceTab(route.oldChannelId, route.newChannelId);
      } else if (route.type === 'activate') {
        setActiveProject(route.cwd);
        requestActivateChannel(route.cwd, route.channelId);
      }
    },
    [
      messages.length,
      activeProjectCwd,
      channelId,
      replaceTab,
      setActiveProject,
      requestActivateChannel,
    ],
  );

  if (!channelId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted text-sm">
        No active session — click + to create a new tab
      </div>
    );
  }

  return (
    <>
      <ChannelOverlays />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <ChatBreadcrumb
          projectName={projectName}
          branch={worktree?.branch}
          sessionTitle={title}
          onToggleLeft={onToggleLeft}
          actions={<ResumeButton onResumed={handleResumed} />}
        />
        {worktree && <WorktreeBanner worktree={worktree} />}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <ChatPanel>
            <ChatPanel.Body>
              <MessageList />
            </ChatPanel.Body>
            <ChatPanel.Footer>
              <ChatInputArea />
            </ChatPanel.Footer>
          </ChatPanel>
        </div>
      </div>
    </>
  );
}
