import type { SessionSummary } from '@code-quest/schemas';
import { RectangleGroupIcon } from '@heroicons/react/24/outline';
import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useChannelComposeActions, useChannelConfig, useChannelId } from '@/contexts/channel';
import { useNavigationActions } from '@/contexts/NavigationContext';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import { useTabActions } from '@/contexts/TabContext';
import { useChannelStore } from '@/stores/ChannelStoreContext';
import { NO_FORM } from '@/utils/hotkey-options';
import { resumeRoute } from '@/utils/resume-route';
import { IconButton } from '../ui/IconButton.tsx';
import { ChannelOverlays } from './ChannelOverlays.tsx';
import { ChatPanel } from './ChatPanel.tsx';
import { ChatInputArea } from './compose/ChatInputArea.tsx';
import { MessageList } from './conversation/MessageList.tsx';
import { HeaderBar } from './HeaderBar.tsx';
import { ResumeButton } from './ResumeButton.tsx';
import { WorktreeBanner } from './WorktreeBanner.tsx';

interface ChatViewProps {
  title?: string;
  onToggleRight?: () => void;
  rightPane?: React.ReactNode;
}

export function ChatView({ title, onToggleRight, rightPane }: ChatViewProps): React.JSX.Element {
  const channelId = useChannelId();
  const messages = useChannelStore((s) => s.messages);
  const { worktree } = useChannelConfig();
  const { focusTextarea } = useChannelComposeActions();
  useHotkeys('/', focusTextarea, NO_FORM);
  const { setActiveProject } = useProjectActions();
  const { requestActivateChannel } = useNavigationActions();
  const { activeProjectCwd } = useProjectState();
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
        <HeaderBar title={title}>
          <ResumeButton onResumed={handleResumed} />
          {onToggleRight && (
            <IconButton
              variant="plain"
              aria-label="Toggle right pane"
              onClick={onToggleRight}
              className="w-7 h-7 text-muted hover:text-text hover:bg-hover-tint"
            >
              <RectangleGroupIcon className="w-4 h-4" />
            </IconButton>
          )}
        </HeaderBar>
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
          {rightPane && (
            <div className="w-72 shrink-0 border-l border-border overflow-y-auto">{rightPane}</div>
          )}
        </div>
      </div>
    </>
  );
}
