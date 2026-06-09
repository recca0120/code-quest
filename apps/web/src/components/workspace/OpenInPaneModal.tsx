import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';

interface SessionInfo {
  channelId: string;
  title?: string;
  status?: 'idle' | 'busy';
  branch?: string;
}

interface WorktreeInfo {
  path: string;
  branch?: string;
  name: string;
}

interface ProjectInfo {
  cwd: string;
  name: string;
}

type ToolTabType = 'git' | 'files' | 'spec';

interface OpenInPaneModalProps {
  open: boolean;
  onClose: () => void;
  sessions?: SessionInfo[];
  projects?: ProjectInfo[];
  allWorktrees?: Record<string, WorktreeInfo[]>;
  activeWorktree?: { path: string; branch?: string };
  activeProjectCwd?: string;
  targetPaneId?: string;
  onSelectSession?: (channelId: string, paneId?: string) => void;
  onNewSession?: (cwd: string, projectCwd: string, paneId?: string) => void;
  onOpenToolPane?: (type: ToolTabType, cwd: string, paneId?: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
  onAddProject?: () => void;
}

type TabId = 'session' | ToolTabType;

const TABS: { id: TabId; label: string }[] = [
  { id: 'session', label: 'Session' },
  { id: 'git', label: '🌿 Git' },
  { id: 'files', label: '📁 Files' },
  { id: 'spec', label: '📋 Spec' },
];

function SessionTab({
  sessions = [],
  projects = [],
  allWorktrees = {},
  targetPaneId,
  onSelectSession,
  onNewSession,
  onNewWorktree,
  onAddProject,
}: Pick<
  OpenInPaneModalProps,
  | 'sessions'
  | 'projects'
  | 'allWorktrees'
  | 'targetPaneId'
  | 'onSelectSession'
  | 'onNewSession'
  | 'onNewWorktree'
  | 'onAddProject'
>) {
  return (
    <div className="flex flex-col gap-3">
      {sessions.length > 0 && (
        <section>
          <p className="text-xs text-muted-foreground mb-1">Existing sessions</p>
          <div className="flex flex-col gap-1">
            {sessions.map((s) => (
              <button
                key={s.channelId}
                type="button"
                data-testid={`modal-session-item-${s.channelId}`}
                onClick={() => onSelectSession?.(s.channelId, targetPaneId)}
                className="px-3 py-2 text-sm text-left rounded hover:bg-accent"
              >
                {s.status === 'busy' ? '●' : '○'}{' '}
                {s.branch && <span className="font-mono opacity-60">⎇ {s.branch} · </span>}
                {s.title ?? s.channelId}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="text-xs text-muted-foreground mb-1">New session in</p>
        <div className="flex flex-col gap-2">
          {projects.map((project) => {
            const wts = allWorktrees[project.cwd] ?? [];
            return (
              <div key={project.cwd}>
                <p className="text-xs font-medium px-1">{project.name}</p>
                {wts.map((wt) => (
                  <div key={wt.path} className="flex items-center justify-between px-1 py-1">
                    <span className="text-sm font-mono opacity-70">⎇ {wt.branch ?? wt.name}</span>
                    <button
                      type="button"
                      onClick={() => onNewSession?.(wt.path, project.cwd, targetPaneId)}
                      className="px-2 py-1 text-xs rounded hover:bg-accent"
                    >
                      + New session
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onNewWorktree?.(project.cwd)}
                  className="px-3 py-2 text-sm text-left rounded hover:bg-accent w-full text-muted-foreground"
                >
                  + New worktree
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => onAddProject?.()}
            className="px-3 py-2 text-sm text-left rounded hover:bg-accent text-muted-foreground"
          >
            + Add project
          </button>
        </div>
      </section>
    </div>
  );
}

const TOOL_LABELS: Record<ToolTabType, string> = {
  git: 'Git',
  files: 'Files',
  spec: 'Spec',
};

function ToolTab({
  type,
  projects = [],
  allWorktrees = {},
  activeWorktree,
  targetPaneId,
  onOpenToolPane,
}: {
  type: ToolTabType;
} & Pick<
  OpenInPaneModalProps,
  'projects' | 'allWorktrees' | 'activeWorktree' | 'targetPaneId' | 'onOpenToolPane'
>) {
  const allOptions: { path: string; label: string }[] = projects.flatMap((p) =>
    (allWorktrees[p.cwd] ?? []).map((wt) => ({
      path: wt.path,
      label: `⎇ ${wt.branch ?? wt.name} (${p.name})`,
    })),
  );

  const defaultPath = activeWorktree?.path ?? allOptions[0]?.path ?? '';
  const [selectedCwd, setSelectedCwd] = useState(defaultPath);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label htmlFor="cwd-select" className="text-sm text-muted-foreground">
          Worktree:
        </label>
        <select
          id="cwd-select"
          aria-label="worktree"
          value={selectedCwd}
          onChange={(e) => setSelectedCwd(e.target.value)}
          className="flex-1 text-sm border border-border rounded px-2 py-1 bg-surface"
        >
          {allOptions.map((opt) => (
            <option key={opt.path} value={opt.path}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onOpenToolPane?.(type, selectedCwd, targetPaneId)}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Open {TOOL_LABELS[type]} pane
        </button>
      </div>
    </div>
  );
}

export function OpenInPaneModal({
  open,
  onClose,
  sessions,
  projects,
  allWorktrees,
  activeWorktree,
  targetPaneId,
  onSelectSession,
  onNewSession,
  onOpenToolPane,
  onNewWorktree,
  onAddProject,
}: OpenInPaneModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('session');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Open in pane" size="lg" scrollable={false}>
        <div role="tablist" className="flex border-b border-border mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-text font-medium'
                  : 'border-transparent text-muted-foreground hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'session' && (
            <SessionTab
              sessions={sessions}
              projects={projects}
              allWorktrees={allWorktrees}
              targetPaneId={targetPaneId}
              onSelectSession={onSelectSession}
              onNewSession={onNewSession}
              onNewWorktree={onNewWorktree}
              onAddProject={onAddProject}
            />
          )}
          {(activeTab === 'git' || activeTab === 'files' || activeTab === 'spec') && (
            <ToolTab
              type={activeTab}
              projects={projects}
              allWorktrees={allWorktrees}
              activeWorktree={activeWorktree}
              targetPaneId={targetPaneId}
              onOpenToolPane={onOpenToolPane}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
