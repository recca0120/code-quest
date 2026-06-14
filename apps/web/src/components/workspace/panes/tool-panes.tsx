import type { PaneContent } from '@/contexts/TabContext';
import { renderPaneView } from '../pane-view-render';
import { useAvailableWorktrees } from '../useAvailableWorktrees.ts';
import { WorktreeSwitcher } from '../WorktreeSwitcher.tsx';
import { Pane, type PaneToolbarCommonProps } from './Pane.tsx';

interface ToolPaneProps {
  paneId: string;
  cwd: string;
  toolbarProps: PaneToolbarCommonProps;
}

interface ToolPaneConfig {
  icon: string;
  label: string;
  makeContent: (cwd: string) => PaneContent;
  renderView: (cwd: string) => React.ReactNode;
}

function createToolPane(config: ToolPaneConfig) {
  return function ToolPane({ paneId, cwd, toolbarProps }: ToolPaneProps): React.JSX.Element {
    const availableWorktrees = useAvailableWorktrees();
    return (
      <Pane
        toolbarProps={toolbarProps}
        tools={
          <WorktreeSwitcher
            icon={config.icon}
            label={config.label}
            cwd={cwd}
            paneId={paneId}
            availableWorktrees={availableWorktrees}
            makeContent={config.makeContent}
          />
        }
      >
        {config.renderView(cwd)}
      </Pane>
    );
  };
}

export const GitPane: (props: ToolPaneProps) => React.JSX.Element = createToolPane({
  icon: '±',
  label: 'Git',
  makeContent: (cwd) => ({ type: 'git', target: { kind: 'fixed', cwd } }),
  renderView: (cwd) => renderPaneView('git', cwd),
});

export const FilesPane: (props: ToolPaneProps) => React.JSX.Element = createToolPane({
  icon: '▤',
  label: 'Files',
  makeContent: (cwd) => ({ type: 'files', target: { kind: 'fixed', cwd } }),
  renderView: (cwd) => renderPaneView('files', cwd),
});

export const OpenspecPane: (props: ToolPaneProps) => React.JSX.Element = createToolPane({
  icon: '◈',
  label: 'Spec',
  makeContent: (cwd) => ({ type: 'openspec', target: { kind: 'fixed', cwd } }),
  renderView: (cwd) => renderPaneView('openspec', cwd),
});
