import { useGitState } from '@/contexts/GitContext';
import { useProjectState } from '@/contexts/ProjectContext';
import {
  collectSessionsInPaneTree,
  firstLeafId,
  usePaneActions,
  usePaneState,
  useTabState,
  useWorkspaceTab,
} from '@/contexts/TabContext';

interface SessionManagerProps {
  onClose: () => void;
  onNewSession?: (cwd: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
  onAddProject?: () => void;
}

export function SessionManager({
  onClose,
  onNewSession,
  onNewWorktree,
  onAddProject,
}: SessionManagerProps): React.JSX.Element {
  const { tabs } = useTabState();
  const { focusedPaneId, paneRoot } = usePaneState();
  const { setSessionInPane, focusPane } = usePaneActions();
  const { workspaceTabs } = useWorkspaceTab();
  const { listing } = useGitState();
  const { projects } = useProjectState();

  function handleSelect(sessionId: string): void {
    const targetId = focusedPaneId ?? firstLeafId(paneRoot);
    if (targetId) {
      setSessionInPane(targetId, sessionId, tabs[sessionId]?.cwd ?? null);
      focusPane(targetId);
    }
    onClose();
  }

  // Compute which sessions are in which workspace tab
  const sessionToTabLabel = new Map<string, string>();
  const allTabSessionIds = new Set<string>();

  for (let i = 0; i < workspaceTabs.length; i++) {
    const wt = workspaceTabs[i];
    if (!wt) continue;
    const label = wt.label ?? `Layout ${i + 1}`;
    const sessionIds = collectSessionsInPaneTree(wt.paneRoot);
    for (const sid of sessionIds) {
      sessionToTabLabel.set(sid, label);
      allTabSessionIds.add(sid);
    }
  }

  // Build groups: per-workspace-tab groups + "No Tab" for unassigned
  interface TabGroup {
    label: string;
    sessions: string[];
  }

  const tabGroups: TabGroup[] = workspaceTabs.map((wt, i) => ({
    label: wt.label ?? `Layout ${i + 1}`,
    sessions: [...collectSessionsInPaneTree(wt.paneRoot)].filter((id) => id in tabs),
  }));

  const noTabSessions = Object.keys(tabs).filter((id) => !allTabSessionIds.has(id));

  // Build cwd → session id map for Projects section
  const cwdToSessionId = new Map<string, string>();
  for (const [id, meta] of Object.entries(tabs)) {
    if (meta.cwd) {
      cwdToSessionId.set(meta.cwd, id);
    }
  }

  return (
    <div
      data-testid="session-manager"
      role="dialog"
      aria-modal="true"
      aria-label="Session Manager"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close session manager"
        className="absolute inset-0 bg-black/40 cursor-default"
        onClick={onClose}
      />
      <div className="relative bg-background border border-border rounded-lg p-4 w-full max-w-xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Workspace</div>
          <button
            type="button"
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground text-xs"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Sessions grouped by workspace tab */}
        {tabGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-2">
              <span>{group.label}</span>
              <span className="flex-1 border-t border-border" />
            </div>
            {group.sessions.length === 0 ? (
              <div className="text-xs text-muted-foreground px-2 py-1 italic">No sessions</div>
            ) : (
              group.sessions.map((id) => {
                const meta = tabs[id];
                if (!meta) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid={`session-manager-item-${id}`}
                    onClick={() => handleSelect(id)}
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
                  >
                    <span className="opacity-60">
                      {meta.tabStatus === 'processing' ? '●' : '○'}
                    </span>
                    {meta.branch && <span className="opacity-70 text-xs">⎇ {meta.branch}</span>}
                    <span className="truncate">{meta.title ?? meta.cwd ?? id}</span>
                  </button>
                );
              })
            )}
          </div>
        ))}

        {/* No Tab group */}
        {noTabSessions.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-2">
              <span>No Tab</span>
              <span className="flex-1 border-t border-border" />
            </div>
            {noTabSessions.map((id) => {
              const meta = tabs[id];
              if (!meta) return null;
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`session-manager-item-${id}`}
                  onClick={() => handleSelect(id)}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2"
                >
                  <span className="opacity-60">{meta.tabStatus === 'processing' ? '●' : '○'}</span>
                  {meta.branch && <span className="opacity-70 text-xs">⎇ {meta.branch}</span>}
                  <span className="truncate">{meta.title ?? meta.cwd ?? id}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Projects section */}
        <div className="mb-2">
          <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-2">
            <span>Projects</span>
            <span className="flex-1 border-t border-border" />
          </div>
          {projects.map((project) => {
            const worktrees = listing[project.cwd];
            const worktreeList = Array.isArray(worktrees) ? worktrees : [];
            return (
              <div key={project.cwd} className="mb-3">
                <div className="text-xs font-medium px-1 mb-1">{project.name}</div>
                {worktreeList.map((wt) => {
                  const sessionId = cwdToSessionId.get(wt.path);
                  const sessionMeta = sessionId ? tabs[sessionId] : null;
                  return (
                    <div key={wt.path} className="flex items-center gap-2 px-2 py-1 text-xs">
                      <span className="opacity-70">⎇ {wt.branch ?? wt.name}</span>
                      {sessionMeta ? (
                        <button
                          type="button"
                          data-testid={`session-manager-item-${sessionId}`}
                          onClick={() => sessionId && handleSelect(sessionId)}
                          className="truncate hover:underline text-left"
                        >
                          {sessionMeta.title ?? sessionMeta.cwd ?? sessionId}
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid="new-session-btn"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => onNewSession?.(wt.path)}
                        >
                          + New session
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="px-2 mt-1">
                  <button
                    type="button"
                    data-testid="new-worktree-btn"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => onNewWorktree?.(project.cwd)}
                  >
                    + New worktree
                  </button>
                </div>
              </div>
            );
          })}
          <div className="mt-2">
            <button
              type="button"
              data-testid="add-project-btn"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onAddProject?.()}
            >
              + Add project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
