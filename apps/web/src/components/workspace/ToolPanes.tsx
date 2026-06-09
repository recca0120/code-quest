import { useState } from 'react';
import { FilesPane as RealFilesPane } from '@/components/files/FilesPane';
import { GitPane as RealGitPane } from '@/components/git/GitPane';
import { SpecPane as RealSpecPane } from '@/components/spec/SpecPane';
import { useGitState } from '@/contexts/GitContext';
import { useProjectState } from '@/contexts/ProjectContext';
import { type PaneContent, usePaneActions } from '@/contexts/TabContext';

export interface WorktreeOption {
  path: string;
  branch?: string;
  name: string;
  projectName?: string;
}

interface ToolPaneProps {
  cwd: string;
  paneId: string;
  availableWorktrees?: WorktreeOption[];
}

interface ToolPaneHeaderProps {
  emoji: string;
  label: string;
  cwd: string;
  paneId: string;
  availableWorktrees?: WorktreeOption[];
  makeContent: (cwd: string) => PaneContent;
}

function branchLabel(wt: WorktreeOption): string {
  return `⎇ ${wt.branch ?? wt.name}`;
}

function ToolPaneHeader({
  emoji,
  label,
  cwd,
  paneId,
  availableWorktrees,
  makeContent,
}: ToolPaneHeaderProps): React.JSX.Element {
  const { setContentInPane } = usePaneActions();
  const [open, setOpen] = useState(false);
  const current = availableWorktrees?.find((w) => w.path === cwd);
  const displayLabel = current ? branchLabel(current) : cwd;

  return (
    <div
      data-testid="tool-pane-header"
      className="flex items-center gap-1 px-2 py-1 text-xs border-b border-border"
    >
      <span>
        {emoji} {label}
      </span>
      <div className="relative ml-1">
        <button
          type="button"
          aria-label="worktree switcher"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-0.5 opacity-70 hover:opacity-100"
        >
          <span>{displayLabel}</span>
          <span>▾</span>
        </button>
        {open && availableWorktrees && availableWorktrees.length > 0 && (
          <div
            data-testid="cwd-dropdown"
            className="absolute top-full left-0 z-50 bg-popover border border-border rounded shadow-md py-1 min-w-40"
          >
            {availableWorktrees.map((wt) => (
              <button
                key={wt.path}
                type="button"
                onClick={() => {
                  setContentInPane(paneId, makeContent(wt.path));
                  setOpen(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent"
              >
                {branchLabel(wt)}
                {wt.projectName ? ` (${wt.projectName})` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GitPane({ cwd, paneId, availableWorktrees }: ToolPaneProps): React.JSX.Element {
  return (
    <div data-testid="git-pane" className="flex flex-col flex-1 min-w-0 min-h-0">
      <ToolPaneHeader
        emoji="🌿"
        label="Git"
        cwd={cwd}
        paneId={paneId}
        availableWorktrees={availableWorktrees}
        makeContent={(c) => ({ type: 'git', cwd: c })}
      />
      <div className="flex-1 overflow-auto min-h-0">
        <RealGitPane cwd={cwd} />
      </div>
    </div>
  );
}

export function FilesPane({ cwd, paneId, availableWorktrees }: ToolPaneProps): React.JSX.Element {
  return (
    <div data-testid="files-pane" className="flex flex-col flex-1 min-w-0 min-h-0">
      <ToolPaneHeader
        emoji="📁"
        label="Files"
        cwd={cwd}
        paneId={paneId}
        availableWorktrees={availableWorktrees}
        makeContent={(c) => ({ type: 'files', cwd: c })}
      />
      <div className="flex-1 overflow-auto min-h-0">
        <RealFilesPane cwd={cwd} onMention={() => {}} />
      </div>
    </div>
  );
}

export function SpecPane({ cwd, paneId, availableWorktrees }: ToolPaneProps): React.JSX.Element {
  return (
    <div data-testid="spec-pane" className="flex flex-col flex-1 min-w-0 min-h-0">
      <ToolPaneHeader
        emoji="📋"
        label="Spec"
        cwd={cwd}
        paneId={paneId}
        availableWorktrees={availableWorktrees}
        makeContent={(c) => ({ type: 'spec', cwd: c })}
      />
      <div className="flex-1 overflow-auto min-h-0">
        <RealSpecPane cwd={cwd} />
      </div>
    </div>
  );
}

export interface WorktreesPaneSession {
  channelId: string;
  cwd: string;
  title?: string;
}

interface WorktreesPaneProps {
  sessions?: WorktreesPaneSession[];
  onNewSession?: (cwd: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
}

export function WorktreesPane({
  sessions = [],
  onNewSession,
  onNewWorktree,
}: WorktreesPaneProps): React.JSX.Element {
  const { listing } = useGitState();
  const { projects } = useProjectState();

  return (
    <div
      data-testid="worktrees-pane"
      className="flex flex-col flex-1 min-w-0 min-h-0 overflow-auto"
    >
      {projects.map((project) => {
        const wts = listing[project.cwd];
        const worktrees = Array.isArray(wts) ? wts : [];
        return (
          <div key={project.cwd} className="p-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">{project.name}</p>
            <ul className="space-y-0.5">
              {worktrees.map((wt) => {
                const session = sessions.find((s) => s.cwd === wt.path);
                return (
                  <li key={wt.path} className="flex items-center justify-between gap-1 text-xs">
                    <span className="flex flex-col min-w-0">
                      <span>⎇ {wt.branch ?? wt.name}</span>
                      <span className="text-muted-foreground truncate">{wt.path}</span>
                      {session?.title && (
                        <span className="text-muted-foreground truncate">{session.title}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Open session for ⎇ ${wt.branch ?? wt.name}`}
                      onClick={() => onNewSession?.(wt.path)}
                      className="shrink-0 opacity-70 hover:opacity-100"
                    >
                      [+]
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              aria-label="New worktree"
              onClick={() => onNewWorktree?.(project.cwd)}
              className="mt-1 text-xs opacity-70 hover:opacity-100"
            >
              [+ New worktree]
            </button>
          </div>
        );
      })}
    </div>
  );
}
