import { FilesView } from '@/components/files/FilesView';
import { GitView } from '@/components/git/GitView';
import { SpecView } from '@/components/spec/SpecView';
import type { PaneContent } from '@/contexts/TabContext';
import { useAvailableWorktrees } from '../useAvailableWorktrees.ts';
import { WorktreeSwitcher } from '../WorktreeSwitcher.tsx';
import { PaneShell, type PaneToolbarCommonProps } from './PaneShell.tsx';

interface ToolPaneProps {
  paneId: string;
  cwd: string;
  toolbarProps: PaneToolbarCommonProps;
}

interface ToolPaneConfig {
  emoji: string;
  label: string;
  makeContent: (cwd: string) => PaneContent;
  renderView: (cwd: string) => React.ReactNode;
}

function createToolPane(config: ToolPaneConfig) {
  return function ToolPane({ paneId, cwd, toolbarProps }: ToolPaneProps): React.JSX.Element {
    const availableWorktrees = useAvailableWorktrees();
    return (
      <PaneShell
        toolbarProps={toolbarProps}
        tools={
          <WorktreeSwitcher
            emoji={config.emoji}
            label={config.label}
            cwd={cwd}
            paneId={paneId}
            availableWorktrees={availableWorktrees}
            makeContent={config.makeContent}
          />
        }
      >
        {config.renderView(cwd)}
      </PaneShell>
    );
  };
}

export const GitPane: (props: ToolPaneProps) => React.JSX.Element = createToolPane({
  emoji: '🌿',
  label: 'Git',
  makeContent: (cwd) => ({ type: 'git', target: { kind: 'fixed', cwd } }),
  renderView: (cwd) => <GitView cwd={cwd} />,
});

export const FilesPane: (props: ToolPaneProps) => React.JSX.Element = createToolPane({
  emoji: '📁',
  label: 'Files',
  makeContent: (cwd) => ({ type: 'files', target: { kind: 'fixed', cwd } }),
  renderView: (cwd) => <FilesView cwd={cwd} onMention={() => {}} />,
});

export const OpenspecPane: (props: ToolPaneProps) => React.JSX.Element = createToolPane({
  emoji: '📋',
  label: 'Spec',
  makeContent: (cwd) => ({ type: 'openspec', target: { kind: 'fixed', cwd } }),
  renderView: (cwd) => <SpecView cwd={cwd} />,
});
