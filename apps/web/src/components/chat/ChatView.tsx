import { useHotkeys } from 'react-hotkeys-hook';
import { useChannelComposeActions, useChannelConfig, useChannelId } from '@/contexts/channel';
import { NO_FORM } from '@/utils/hotkey-options';
import { ChannelOverlays } from './ChannelOverlays.tsx';
import { ChatShell } from './ChatShell.tsx';
import { ChatInputArea } from './compose/ChatInputArea.tsx';
import { MessageList } from './conversation/MessageList.tsx';
import { WorktreeBanner } from './WorktreeBanner.tsx';

export function ChatView(): React.JSX.Element {
  const channelId = useChannelId();
  const { worktree } = useChannelConfig();
  const { focusTextarea } = useChannelComposeActions();
  useHotkeys('/', focusTextarea, NO_FORM);

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
        {worktree && <WorktreeBanner worktree={worktree} />}
        <ChatShell>
          <ChatShell.Body>
            <MessageList />
          </ChatShell.Body>
          <ChatShell.Footer>
            <ChatInputArea />
          </ChatShell.Footer>
        </ChatShell>
      </div>
    </>
  );
}
