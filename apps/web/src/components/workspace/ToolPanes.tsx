import { useState } from 'react';
import { type PaneContent, usePaneActions } from '@/contexts/TabContext';
import { basename } from '@/utils/basename';

interface ToolPaneProps {
  cwd: string;
  paneId: string;
  availableCwds?: string[];
}

interface ToolPaneHeaderProps {
  emoji: string;
  label: string;
  cwd: string;
  paneId: string;
  availableCwds?: string[];
  makeContent: (cwd: string) => PaneContent;
}

function ToolPaneHeader({
  emoji,
  label,
  cwd,
  paneId,
  availableCwds,
  makeContent,
}: ToolPaneHeaderProps): React.JSX.Element {
  const { setContentInPane } = usePaneActions();
  const [open, setOpen] = useState(false);

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
          aria-label="cwd switcher"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-0.5 opacity-70 hover:opacity-100"
        >
          <span>{basename(cwd)}</span>
          <span>▾</span>
        </button>
        {open && availableCwds && availableCwds.length > 0 && (
          <div
            data-testid="cwd-dropdown"
            className="absolute top-full left-0 z-50 bg-popover border border-border rounded shadow-md py-1 min-w-32"
          >
            {availableCwds.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setContentInPane(paneId, makeContent(c));
                  setOpen(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent"
              >
                {basename(c)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GitPane({ cwd, paneId, availableCwds }: ToolPaneProps): React.JSX.Element {
  return (
    <div data-testid="git-pane" className="flex flex-col flex-1 min-w-0 min-h-0">
      <ToolPaneHeader
        emoji="🌿"
        label="Git"
        cwd={cwd}
        paneId={paneId}
        availableCwds={availableCwds}
        makeContent={(c) => ({ type: 'git', cwd: c })}
      />
      <div className="p-4 flex-1">
        <p className="text-sm text-muted-foreground">Git — {cwd}</p>
      </div>
    </div>
  );
}

export function FilesPane({ cwd, paneId, availableCwds }: ToolPaneProps): React.JSX.Element {
  return (
    <div data-testid="files-pane" className="flex flex-col flex-1 min-w-0 min-h-0">
      <ToolPaneHeader
        emoji="📁"
        label="Files"
        cwd={cwd}
        paneId={paneId}
        availableCwds={availableCwds}
        makeContent={(c) => ({ type: 'files', cwd: c })}
      />
      <div className="p-4 flex-1">
        <p className="text-sm text-muted-foreground">Files — {cwd}</p>
      </div>
    </div>
  );
}

export function SpecPane({ cwd, paneId, availableCwds }: ToolPaneProps): React.JSX.Element {
  return (
    <div data-testid="spec-pane" className="flex flex-col flex-1 min-w-0 min-h-0">
      <ToolPaneHeader
        emoji="📋"
        label="Spec"
        cwd={cwd}
        paneId={paneId}
        availableCwds={availableCwds}
        makeContent={(c) => ({ type: 'spec', cwd: c })}
      />
      <div className="p-4 flex-1">
        <p className="text-sm text-muted-foreground">Spec — {cwd}</p>
      </div>
    </div>
  );
}

export function WorktreesPane(): React.JSX.Element {
  return (
    <div data-testid="worktrees-pane" className="flex flex-col flex-1 min-w-0 min-h-0 p-4">
      <p className="text-sm text-muted-foreground">Worktrees</p>
    </div>
  );
}
