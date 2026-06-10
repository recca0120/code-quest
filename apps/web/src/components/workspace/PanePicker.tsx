import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';

interface SessionInfo {
  channelId: string;
  title?: string;
  status?: 'idle' | 'busy';
  branch?: string;
  paneLabel?: string;
  cwd?: string;
}

interface PastSessionInfo {
  id: string;
  channelId: string;
  title?: string;
  cwd?: string;
  createdAt: string;
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
type ImportFormat = 'claude-jsonl';

interface PanePickerProps {
  open: boolean;
  onClose: () => void;
  sessions?: SessionInfo[];
  pastSessions?: PastSessionInfo[];
  projects?: ProjectInfo[];
  allWorktrees?: Record<string, WorktreeInfo[]>;
  activeProjectCwd?: string;
  targetPaneId?: string;
  onShowHere?: (channelId: string, paneId?: string) => void;
  onResume?: (sessionId: string) => void;
  onNewSession?: (cwd: string, projectCwd: string, paneId?: string) => void;
  onOpenToolPane?: (type: ToolTabType, cwd: string, paneId?: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
  onImport?: (format: ImportFormat, cwd: string) => void;
  onAddProject?: () => void;
}

// ── AI providers ─────────────────────────────────────────────────────────────

// 目前只有 Claude；未來加 Codex 時擴充，UI 自動升為三層
const AI_PROVIDERS = ['claude'] as const;
type AiProvider = (typeof AI_PROVIDERS)[number];

const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  claude: '💬 Claude',
};

// ── view state ────────────────────────────────────────────────────────────────

type PickerView =
  | { type: 'main' }
  | { type: 'ai'; worktreePath: string; projectCwd: string; branch: string }
  | {
      type: 'ai-provider';
      worktreePath: string;
      projectCwd: string;
      branch: string;
      provider: AiProvider;
    }
  | { type: 'resume'; worktreePath: string; branch: string; provider: AiProvider }
  | { type: 'import'; worktreePath: string; branch: string; provider: AiProvider };

function relativeTime(iso: string): string {
  const diffH = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

const TOOL_LABELS: Record<ToolTabType, string> = {
  git: '🌿 Git',
  files: '📁 Files',
  spec: '📋 Spec',
};

// ── sub-views ─────────────────────────────────────────────────────────────────

function AiActionsView({
  worktreePath,
  projectCwd,
  branch,
  provider,
  targetPaneId,
  pastSessions,
  onNewSession,
  onNavigate,
  onBack,
  titlePrefix,
}: {
  worktreePath: string;
  projectCwd: string;
  branch: string;
  provider: AiProvider;
  targetPaneId?: string;
  pastSessions: PastSessionInfo[];
  onNewSession?: (cwd: string, projectCwd: string, paneId?: string) => void;
  onNavigate: (view: Exclude<PickerView, { type: 'main' }>) => void;
  onBack: () => void;
  titlePrefix: string;
}) {
  const hasPastSessions = pastSessions.some((s) => s.cwd === worktreePath);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={onBack} className="text-sm font-mono">
          ←
        </button>
        <span className="text-sm text-muted-foreground">
          {titlePrefix} — ⎇ {branch}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onNewSession?.(worktreePath, projectCwd, targetPaneId)}
        className="px-3 py-2 text-sm text-left rounded border border-border hover:bg-accent"
      >
        + New Session
      </button>
      {hasPastSessions && (
        <button
          type="button"
          onClick={() => onNavigate({ type: 'resume', worktreePath, branch, provider })}
          className="px-3 py-2 text-sm text-left rounded border border-border hover:bg-accent"
        >
          ⟳ Resume ▶
        </button>
      )}
      <button
        type="button"
        onClick={() => onNavigate({ type: 'import', worktreePath, branch, provider })}
        className="px-3 py-2 text-sm text-left rounded border border-border hover:bg-accent"
      >
        ⬆ Import ▶
      </button>
    </div>
  );
}

function AiPickerView({
  worktreePath,
  projectCwd,
  branch,
  targetPaneId,
  pastSessions,
  onNewSession,
  onNavigate,
  onBack,
}: {
  worktreePath: string;
  projectCwd: string;
  branch: string;
  targetPaneId?: string;
  pastSessions: PastSessionInfo[];
  onNewSession?: (cwd: string, projectCwd: string, paneId?: string) => void;
  onNavigate: (view: Exclude<PickerView, { type: 'main' }>) => void;
  onBack: () => void;
}) {
  // 單一 provider：折疊為兩層，直接顯示 actions
  if (AI_PROVIDERS.length === 1) {
    return (
      <AiActionsView
        worktreePath={worktreePath}
        projectCwd={projectCwd}
        branch={branch}
        provider={AI_PROVIDERS[0]}
        targetPaneId={targetPaneId}
        pastSessions={pastSessions}
        onNewSession={onNewSession}
        onNavigate={onNavigate}
        onBack={onBack}
        titlePrefix="AI"
      />
    );
  }

  // 多個 providers：顯示 provider 列表
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={onBack} className="text-sm font-mono">
          ←
        </button>
        <span className="text-sm text-muted-foreground">AI — ⎇ {branch}</span>
      </div>
      {AI_PROVIDERS.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() =>
            onNavigate({ type: 'ai-provider', worktreePath, projectCwd, branch, provider })
          }
          className="px-3 py-2 text-sm text-left rounded border border-border hover:bg-accent"
        >
          {AI_PROVIDER_LABELS[provider]} ▶
        </button>
      ))}
    </div>
  );
}

function ResumeView({
  worktreePath,
  branch,
  pastSessions,
  onResume,
  onBack,
}: {
  worktreePath: string;
  branch: string;
  pastSessions: PastSessionInfo[];
  onResume?: (sessionId: string) => void;
  onBack: () => void;
}) {
  const sessions = pastSessions.filter((s) => s.cwd === worktreePath);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={onBack} className="text-sm font-mono">
          ←
        </button>
        <span className="text-sm text-muted-foreground">Resume — ⎇ {branch}</span>
      </div>
      {sessions.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between px-3 py-2 rounded hover:bg-accent text-sm"
        >
          <span className="flex flex-col">
            <span>{s.title ?? s.id}</span>
            <span className="text-xs text-muted-foreground">{relativeTime(s.createdAt)}</span>
          </span>
          <button
            type="button"
            onClick={() => onResume?.(s.id)}
            className="px-2 py-1 text-xs rounded border border-border hover:bg-accent ml-2 shrink-0"
          >
            Resume
          </button>
        </div>
      ))}
    </div>
  );
}

function ImportView({
  worktreePath,
  branch,
  onImport,
  onBack,
}: {
  worktreePath: string;
  branch: string;
  onImport?: (format: ImportFormat, cwd: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={onBack} className="text-sm font-mono">
          ←
        </button>
        <span className="text-sm text-muted-foreground">Import — ⎇ {branch}</span>
      </div>
      <button
        type="button"
        onClick={() => onImport?.('claude-jsonl', worktreePath)}
        className="px-3 py-2 text-sm text-left rounded border border-border hover:bg-accent"
      >
        📄 Claude JSONL
      </button>
    </div>
  );
}

// ── main view ─────────────────────────────────────────────────────────────────

function MainView({
  sessions,
  projects,
  allWorktrees,
  targetPaneId,
  onShowHere,
  onOpenToolPane,
  onNewWorktree,
  onAddProject,
  onNavigate,
}: {
  sessions: SessionInfo[];
  projects: ProjectInfo[];
  allWorktrees: Record<string, WorktreeInfo[]>;
  targetPaneId?: string;
  onShowHere?: (channelId: string, paneId?: string) => void;
  onOpenToolPane?: (type: ToolTabType, cwd: string, paneId?: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
  onAddProject?: () => void;
  onNavigate: (view: Exclude<PickerView, { type: 'main' }>) => void;
}) {
  return (
    <div className="flex flex-col gap-4 py-2">
      {projects.map((project) => (
        <div key={project.cwd}>
          <p className="text-xs font-semibold text-muted-foreground px-1 mb-1 uppercase tracking-wide">
            {project.name}
          </p>

          {(allWorktrees[project.cwd] ?? []).map((wt) => {
            const activeSessions = sessions.filter((s) => s.cwd === wt.path);
            const hasSession = activeSessions.length > 0;
            const branch = wt.branch ?? wt.name;

            return (
              <div
                key={wt.path}
                data-has-session={hasSession ? 'true' : 'false'}
                className="mb-3 pl-2 border-l-2 border-border"
              >
                <p className="text-sm font-mono text-foreground mb-2">
                  <span className={hasSession ? 'text-green-500' : 'text-muted-foreground'}>
                    {hasSession ? '●' : '○'}
                  </span>{' '}
                  ⎇ {branch}
                </p>

                {activeSessions.length > 0 && (
                  <div className="flex flex-col gap-1 mb-2">
                    {activeSessions.map((s) => (
                      <div
                        key={s.channelId}
                        data-testid={`modal-session-item-${s.channelId}`}
                        className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent text-sm"
                      >
                        <span>
                          {s.status === 'busy' ? '●' : '○'}{' '}
                          {s.branch && (
                            <span className="font-mono opacity-60">⎇ {s.branch} · </span>
                          )}
                          {s.title ?? s.channelId}
                          {s.paneLabel && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ← {s.paneLabel}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => onShowHere?.(s.channelId, targetPaneId)}
                          className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground ml-2 shrink-0"
                        >
                          Show here
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        type: 'ai',
                        worktreePath: wt.path,
                        projectCwd: project.cwd,
                        branch,
                      })
                    }
                    className="px-2.5 py-1 text-xs rounded border border-border hover:bg-accent"
                  >
                    💬 AI ▶
                  </button>
                  {(['git', 'files', 'spec'] as ToolTabType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      data-tool={type}
                      onClick={() => onOpenToolPane?.(type, wt.path, targetPaneId)}
                      className="px-2.5 py-1 text-xs rounded border border-border hover:bg-accent"
                    >
                      {TOOL_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {onNewWorktree && (
            <button
              type="button"
              onClick={() => onNewWorktree(project.cwd)}
              className="text-xs text-muted-foreground hover:text-foreground px-1 mb-1"
            >
              + New worktree
            </button>
          )}
        </div>
      ))}

      {onAddProject && (
        <button
          type="button"
          onClick={onAddProject}
          className="text-sm text-muted-foreground hover:text-foreground px-1 mt-2"
        >
          + Add project
        </button>
      )}
    </div>
  );
}

// ── PanePicker ────────────────────────────────────────────────────────────────

export function PanePicker({
  open,
  onClose,
  sessions = [],
  pastSessions = [],
  projects = [],
  allWorktrees = {},
  targetPaneId,
  onShowHere,
  onResume,
  onNewSession,
  onOpenToolPane,
  onNewWorktree,
  onImport,
  onAddProject,
}: PanePickerProps): React.JSX.Element {
  const [viewStack, setViewStack] = useState<PickerView[]>([{ type: 'main' }]);
  const currentView = viewStack[viewStack.length - 1] ?? { type: 'main' as const };

  // Reset to main view whenever the picker opens
  useEffect(() => {
    if (open) setViewStack([{ type: 'main' }]);
  }, [open]);

  function navigate(view: Exclude<PickerView, { type: 'main' }>) {
    setViewStack((prev) => [...prev, view]);
  }

  function goBack() {
    setViewStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function handleClose() {
    setViewStack([{ type: 'main' }]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent title="Open in pane" size="lg">
        {currentView.type === 'main' && (
          <MainView
            sessions={sessions}
            projects={projects}
            allWorktrees={allWorktrees}
            targetPaneId={targetPaneId}
            onShowHere={onShowHere}
            onOpenToolPane={onOpenToolPane}
            onNewWorktree={onNewWorktree}
            onAddProject={onAddProject}
            onNavigate={navigate}
          />
        )}
        {currentView.type === 'ai' && (
          <AiPickerView
            worktreePath={currentView.worktreePath}
            projectCwd={currentView.projectCwd}
            branch={currentView.branch}
            targetPaneId={targetPaneId}
            pastSessions={pastSessions}
            onNewSession={onNewSession}
            onNavigate={navigate}
            onBack={goBack}
          />
        )}
        {currentView.type === 'ai-provider' && (
          <AiActionsView
            worktreePath={currentView.worktreePath}
            projectCwd={currentView.projectCwd}
            branch={currentView.branch}
            provider={currentView.provider}
            targetPaneId={targetPaneId}
            pastSessions={pastSessions}
            onNewSession={onNewSession}
            onNavigate={navigate}
            onBack={goBack}
            titlePrefix={AI_PROVIDER_LABELS[currentView.provider]}
          />
        )}
        {currentView.type === 'resume' && (
          <ResumeView
            worktreePath={currentView.worktreePath}
            branch={currentView.branch}
            pastSessions={pastSessions}
            onResume={onResume}
            onBack={goBack}
          />
        )}
        {currentView.type === 'import' && (
          <ImportView
            worktreePath={currentView.worktreePath}
            branch={currentView.branch}
            onImport={onImport}
            onBack={goBack}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
