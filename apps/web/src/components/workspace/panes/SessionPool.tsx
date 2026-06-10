import { useMemo } from 'react';
import { useProjectState } from '@/contexts/ProjectContext';
import {
  collectSessionsInPaneTree,
  useTabState,
  useWorkspaceTabState,
} from '@/contexts/TabContext';
import { TabContent } from '../TabContent.tsx';
import { useWorktreeLookup } from '../useAvailableWorktrees.ts';
import { usePaneEnvironment } from './PaneEnvironmentContext.tsx';

const NOOP = (): void => {};

/**
 * Keeps every live session's ChannelProvider mounted exactly once even when it
 * is not visible in the active tab's pane tree:
 * - inactive-tab-sessions: sessions assigned to panes of INACTIVE workspace tabs
 *   (must stay mounted across tab switches to avoid "Channel already exists")
 * - session-pool: sessions not assigned to any pane in any workspace tab
 */
export function SessionPool(): React.JSX.Element {
  const { tabs } = useTabState();
  const { workspaceTabs, activeWorkspaceTabId } = useWorkspaceTabState();
  const env = usePaneEnvironment();
  const { projects, activeProjectCwd } = useProjectState();
  const lookup = useWorktreeLookup();
  const projectNameOf = (meta: { projectCwd?: string; cwd?: string }): string => {
    const projectCwd = meta.projectCwd ?? (meta.cwd ? lookup.get(meta.cwd)?.projectCwd : undefined);
    return projects.find((p) => p.cwd === (projectCwd ?? activeProjectCwd))?.name ?? '';
  };

  // Single source of truth: both sets derive from workspaceTabs (the active
  // tab's paneRoot is workspaceTabs[active].paneRoot — no usePaneState needed)
  const { inactiveTabSessionIds, allPaneSessions } = useMemo(() => {
    const inactive: string[] = [];
    const all = new Set<string>();
    for (const t of workspaceTabs) {
      const ids = collectSessionsInPaneTree(t.paneRoot);
      for (const id of ids) all.add(id);
      if (t.id !== activeWorkspaceTabId) inactive.push(...ids);
    }
    return { inactiveTabSessionIds: inactive, allPaneSessions: all };
  }, [workspaceTabs, activeWorkspaceTabId]);

  return (
    <>
      <div data-testid="inactive-tab-sessions" hidden aria-hidden="true">
        {inactiveTabSessionIds.map((id) => {
          const meta = tabs[id];
          if (!meta) return null;
          return (
            <TabContent
              key={id}
              channelId={id}
              cwd={meta.cwd}
              branch={meta.branch}
              title={meta.title}
              projectName={projectNameOf(meta)}
              mode={meta.mode}
              onNewChannel={NOOP}
            />
          );
        })}
      </div>

      <div data-testid="session-pool" hidden aria-hidden="true" style={{ display: 'none' }}>
        {Object.entries(tabs)
          .filter(([id]) => !allPaneSessions.has(id))
          .map(([id, meta]) => (
            <TabContent
              key={id}
              channelId={id}
              cwd={meta.cwd}
              branch={meta.branch}
              title={meta.title}
              projectName={projectNameOf(meta)}
              mode={meta.mode}
              onToggleLeft={env.onToggleLeft}
              onNewChannel={(newCwd) => env.onNewTab({ cwd: newCwd })}
            />
          ))}
      </div>
    </>
  );
}
