import { ChannelProvider } from '@/contexts/channel';
import { type TabMeta, useTabActions } from '@/contexts/TabContext';
import { ChatView } from '../chat/ChatView.tsx';

export interface TabContentProps extends Pick<TabMeta, 'cwd' | 'mode' | 'branch'> {
  channelId: string;
  onNewChannel?: (cwd: string) => void;
  rightPane?: React.ReactNode;
  /** rail 寬（px）→ ChatView rail wrapper 的 inline width（rail resize persist） */
  railWidth?: number;
}

/**
 * The single ChannelProvider mount unit for a session — shared between panes and
 * SessionPool. Must stay standalone: inlining it into SessionPane would break the
 * pool's anti-double-mount guarantee ("Channel already exists").
 */
export function TabContent({
  channelId,
  cwd,
  branch,
  mode,
  onNewChannel,
  rightPane,
  railWidth,
}: TabContentProps): React.JSX.Element {
  const { setTabTitle, setTabStatus, setTabPermissionMode } = useTabActions();
  return (
    <ChannelProvider
      channelId={channelId}
      cwd={cwd}
      branch={branch}
      mode={mode}
      onChange={(update) => {
        if (update.title) setTabTitle(channelId, update.title);
        if (update.status) setTabStatus(channelId, update.status);
        if (update.permissionMode) setTabPermissionMode(channelId, update.permissionMode);
      }}
      onNewChannel={onNewChannel}
    >
      <ChatView rightPane={rightPane} railWidth={railWidth} />
    </ChannelProvider>
  );
}
