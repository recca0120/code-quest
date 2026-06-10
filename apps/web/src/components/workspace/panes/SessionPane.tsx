import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProjectState } from '@/contexts/ProjectContext';
import { type PaneContent, useTabState } from '@/contexts/TabContext';
import { RightPane } from '../RightPane.tsx';
import { TabContent } from '../TabContent.tsx';
import { useAvailableWorktrees } from '../useAvailableWorktrees.ts';
import { usePaneEnvironment } from './PaneEnvironmentContext.tsx';
import { PaneShell, type PaneToolbarCommonProps } from './PaneShell.tsx';

type SessionContent = Extract<PaneContent, { type: 'session' }>;

/**
 * Liveness is a render-time concern: meta present → TabContent (mode:'resume'
 * rebind, never spawns); absent → EmptyPane with a restore hint resolved from
 * content.cwd against the live worktree listing (never persisted — stale-proof).
 * Both transitions are automatic (self-heal) because they only depend on tabs.
 */
export function SessionPane({
  paneId,
  content,
  toolbarProps,
}: {
  paneId: string;
  content: SessionContent;
  toolbarProps: PaneToolbarCommonProps;
}): React.JSX.Element {
  const { tabs } = useTabState();
  const env = usePaneEnvironment();
  const availableWorktrees = useAvailableWorktrees();
  const { projects, activeProjectCwd } = useProjectState();
  const [rightOpen, setRightOpen] = useState(false);

  const meta = content.sessionId ? tabs[content.sessionId] : null;

  if (!content.sessionId || !meta) {
    const hintWorktree = content.cwd
      ? availableWorktrees.find((wt) => wt.path === content.cwd)
      : undefined;
    const hint = hintWorktree
      ? `Last: ${hintWorktree.projectName} ⎇ ${hintWorktree.branch ?? hintWorktree.name}`
      : undefined;
    return (
      <PaneShell toolbarProps={toolbarProps} scrollable={false}>
        <EmptyState
          data-testid="empty-pane"
          icon={<ChatBubbleLeftRightIcon className="w-10 h-10" />}
          message="Empty pane"
          hint={hint}
          actionLabel="New Session"
          onAction={
            env.onOpenModal
              ? () => env.onOpenModal?.(paneId)
              : () => env.onNewTab({ targetPaneId: paneId })
          }
        />
      </PaneShell>
    );
  }

  const projectName = projects.find((p) => p.cwd === activeProjectCwd)?.name ?? '';

  return (
    <PaneShell
      toolbarProps={{ ...toolbarProps, branch: meta.branch, title: meta.title }}
      scrollable={false}
    >
      <TabContent
        channelId={content.sessionId}
        cwd={meta.cwd}
        branch={meta.branch}
        title={meta.title}
        projectName={projectName}
        mode={meta.mode}
        onToggleLeft={env.onToggleLeft}
        onToggleRight={meta.cwd ? () => setRightOpen((v) => !v) : undefined}
        onNewChannel={(newCwd) => env.onNewTab({ cwd: newCwd })}
        rightPane={rightOpen && meta.cwd ? <RightPane cwd={meta.cwd} /> : undefined}
      />
    </PaneShell>
  );
}
