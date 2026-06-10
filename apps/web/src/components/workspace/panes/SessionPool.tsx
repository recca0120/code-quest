import { useMemo } from 'react';
import { useProjectState } from '@/contexts/ProjectContext';
import {
  collectSessionsInPaneTree,
  usePaneState,
  useTabState,
  useWorkspaceTab,
} from '@/contexts/TabContext';
import { TabContent } from '../TabContent.tsx';
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
  const { workspaceTabs, activeWorkspaceTabId } = useWorkspaceTab();
  const { paneRoot } = usePaneState();
  const env = usePaneEnvironment();
  const { projects, activeProjectCwd } = useProjectState();
  const projectName = projects.find((p) => p.cwd === activeProjectCwd)?.name ?? '';

  const inactiveTabSessionIds = useMemo(
    () =>
      workspaceTabs
        .filter((t) => t.id !== activeWorkspaceTabId)
        .flatMap((t) => [...collectSessionsInPaneTree(t.paneRoot)]),
    [workspaceTabs, activeWorkspaceTabId],
  );

  const sessionsInPanes = collectSessionsInPaneTree(paneRoot);
  const allPaneSessions = new Set([...sessionsInPanes, ...inactiveTabSessionIds]);

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
              projectName={projectName}
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
              projectName={projectName}
              mode={meta.mode}
              onToggleLeft={env.onToggleLeft}
              onNewChannel={(newCwd) => env.onNewTab({ cwd: newCwd })}
            />
          ))}
      </div>
    </>
  );
}
