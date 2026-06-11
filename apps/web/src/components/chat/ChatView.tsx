import { useHotkeys } from 'react-hotkeys-hook';
import { useChannelComposeActions, useChannelConfig, useChannelId } from '@/contexts/channel';
import { NO_FORM } from '@/utils/hotkey-options';
import { ChannelOverlays } from './ChannelOverlays.tsx';
import { ChatShell } from './ChatShell.tsx';
import { ChatInputArea } from './compose/ChatInputArea.tsx';
import { MessageList } from './conversation/MessageList.tsx';
import { WorktreeBanner } from './WorktreeBanner.tsx';

interface ChatViewProps {
  rightPane?: React.ReactNode;
  /** rail 寬（px，拖寬把手 persist）；缺省走 --rail-w token */
  railWidth?: number;
}

export function ChatView({ rightPane, railWidth }: ChatViewProps): React.JSX.Element {
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
        <div className="flex flex-1 overflow-hidden min-h-0">
          <ChatShell>
            <ChatShell.Body>
              <MessageList />
            </ChatShell.Body>
            <ChatShell.Footer>
              <ChatInputArea />
            </ChatShell.Footer>
          </ChatShell>
          {rightPane && (
            <div
              data-testid="chat-rail-wrapper"
              className="w-(--rail-w) shrink-0 border-l border-border-subtle overflow-y-auto"
              // inline width 蓋過 class 的 token 預設（rail resize persist）
              style={railWidth !== undefined ? { width: railWidth } : undefined}
            >
              {rightPane}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
