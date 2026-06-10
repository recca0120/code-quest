import { useState } from 'react';
import { type PaneContent, usePaneActions } from '@/contexts/TabContext';

interface WorktreeOption {
  path: string;
  branch?: string;
  name: string;
  projectName?: string;
}

interface WorktreeSwitcherProps {
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

export function WorktreeSwitcher({
  emoji,
  label,
  cwd,
  paneId,
  availableWorktrees,
  makeContent,
}: WorktreeSwitcherProps): React.JSX.Element {
  const { setContentInPane } = usePaneActions();
  const [open, setOpen] = useState(false);
  const current = availableWorktrees?.find((w) => w.path === cwd);
  const displayLabel = current ? branchLabel(current) : cwd;

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        aria-label="worktree switcher"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 text-xs opacity-70 hover:opacity-100"
      >
        <span>
          {emoji} {label}
        </span>
        <span className="ml-1">{displayLabel}</span>
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
  );
}
