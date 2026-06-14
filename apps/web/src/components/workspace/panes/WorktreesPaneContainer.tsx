import { useTabState } from '@/contexts/TabContext';
import { WorktreesPane } from '../WorktreesPane.tsx';
import { Pane, type PaneToolbarCommonProps } from './Pane.tsx';
import { usePaneEnvironment } from './PaneEnvironmentContext.tsx';

export function WorktreesPaneContainer({
  toolbarProps,
}: {
  toolbarProps: PaneToolbarCommonProps;
}): React.JSX.Element {
  const { tabs } = useTabState();
  const env = usePaneEnvironment();
  return (
    <Pane toolbarProps={toolbarProps}>
      <WorktreesPane
        sessions={Object.entries(tabs).map(([id, m]) => ({
          channelId: id,
          cwd: m.cwd ?? '',
          title: m.title,
        }))}
        onNewSession={(cwd) => env.onNewTab({ cwd })}
        onNewWorktree={env.onNewWorktree}
      />
    </Pane>
  );
}
