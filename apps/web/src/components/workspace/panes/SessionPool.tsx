import { useMemo } from 'react';
import {
  collectSessionsInPaneTree,
  type PaneNode,
  usePaneState,
  useTabState,
  useWorkspaceTabState,
} from '@/contexts/TabContext';
import { TabContent } from '../TabContent.tsx';
import { useVisiblePaneIds } from '../useVisiblePanes.ts';
import { usePaneEnvironment } from './PaneEnvironmentContext.tsx';

const NOOP = (): void => {};

/**
 * Keeps every live session's ChannelProvider mounted exactly once even when it
 * is not visible in the active tab's pane tree:
 * - inactive-tab-sessions: sessions assigned to panes of INACTIVE workspace tabs
 *   (must stay mounted across tab switches to avoid "Channel already exists")
 * - session-pool: sessions not assigned to any pane in any workspace tab
 */
/** active tab 中 assigned 但 leaf 不在 visible 集合的 sessions（RWD/zoom 收納） */
function collectCondensedSessions(root: PaneNode, visible: Set<string> | null): string[] {
  if (!visible) return [];
  const out: string[] = [];
  function walk(n: PaneNode): void {
    if (n.type === 'leaf') {
      if (n.content.type === 'session' && n.content.sessionId && !visible?.has(n.id)) {
        out.push(n.content.sessionId);
      }
      return;
    }
    walk(n.first);
    walk(n.second);
  }
  walk(root);
  return out;
}

export function SessionPool(): React.JSX.Element {
  const { tabs } = useTabState();
  const { workspaceTabs, activeWorkspaceTabId } = useWorkspaceTabState();
  const { paneRoot } = usePaneState();
  const { visible } = useVisiblePaneIds();
  const env = usePaneEnvironment();

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

  // 收納不銷毀（workspace-rwd spec）：zoom／tablet／mobile 下不渲染的 pane，
  // 其 session 在這裡 hidden 保活——回桌面或重新可見時不需 rebind
  const condensedSessionIds = collectCondensedSessions(paneRoot, visible);

  return (
    <>
      <div data-testid="condensed-pane-sessions" hidden aria-hidden="true">
        {condensedSessionIds.map((id) => {
          const meta = tabs[id];
          if (!meta) return null;
          return (
            <TabContent
              key={id}
              channelId={id}
              cwd={meta.cwd}
              branch={meta.branch}
              mode={meta.mode}
              onNewChannel={NOOP}
            />
          );
        })}
      </div>

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
              mode={meta.mode}
              onNewChannel={(newCwd) => env.onNewTab({ cwd: newCwd })}
            />
          ))}
      </div>
    </>
  );
}
