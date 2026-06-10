import { ChannelProvider } from '@/contexts/channel';
import { type TabMeta, useTabActions } from '@/contexts/TabContext';
import { ChatView } from '../chat/ChatView.tsx';

export interface TabContentProps extends Pick<TabMeta, 'cwd' | 'title' | 'mode' | 'branch'> {
  channelId: string;
  projectName: string;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
  onNewChannel?: (cwd: string) => void;
  rightPane?: React.ReactNode;
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
  title,
  projectName,
  mode,
  onToggleLeft,
  onToggleRight,
  onNewChannel,
  rightPane,
}: TabContentProps): React.JSX.Element {
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
        onToggleRight={onToggleRight}
        rightPane={rightPane}
      />
    </ChannelProvider>
  );
}
