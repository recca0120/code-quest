import { useTabState } from '@/contexts/TabContext';
import { WorktreesPane } from '../ToolPanes.tsx';
import { usePaneEnvironment } from './PaneEnvironmentContext.tsx';
import { PaneShell, type PaneToolbarCommonProps } from './PaneShell.tsx';

export function WorktreesPaneContainer({
  toolbarProps,
}: {
  toolbarProps: PaneToolbarCommonProps;
}): React.JSX.Element {
  const { tabs } = useTabState();
  const env = usePaneEnvironment();
  return (
    <PaneShell toolbarProps={toolbarProps}>
      <WorktreesPane
        sessions={Object.entries(tabs).map(([id, m]) => ({
          channelId: id,
          cwd: m.cwd ?? '',
          title: m.title,
        }))}
        onNewSession={(cwd) => env.onNewTab({ cwd })}
        onNewWorktree={env.onNewWorktree}
      />
    </PaneShell>
  );
}
