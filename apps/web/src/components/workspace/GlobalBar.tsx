import { Cog6ToothIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, open, close]);
}

interface ProjectInfo {
  cwd: string;
  name: string;
}

interface WorktreeInfo {
  path: string;
  branch?: string;
  name: string;
}

interface GlobalBarProps {
  projects: ProjectInfo[];
  activeProjectCwd: string | null;
  worktrees: WorktreeInfo[];
  onSelectProject: (cwd: string) => void;
  onAddProject: () => void;
  onNewSession: (cwd: string) => void;
  onCreateWorktree?: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

export function GlobalBar({
  projects,
  activeProjectCwd,
  worktrees,
  onSelectProject,
  onAddProject,
  onNewSession,
  onCreateWorktree,
  onOpenSearch,
  onOpenSettings,
}: GlobalBarProps): React.JSX.Element {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);

  const projectMenuRef = useRef<HTMLDivElement>(null);
  const sessionPickerRef = useRef<HTMLDivElement>(null);

  useClickOutside(projectMenuRef, projectMenuOpen, () => setProjectMenuOpen(false));
  useClickOutside(sessionPickerRef, sessionPickerOpen, () => setSessionPickerOpen(false));

  const activeProject = projects.find((p) => p.cwd === activeProjectCwd);

  return (
    <header
      data-testid="global-bar"
      className="flex items-center gap-2 h-9 px-3 border-b border-border bg-surface shrink-0"
    >
      {/* Project switcher */}
      <div ref={projectMenuRef} className="relative">
        <button
          type="button"
          aria-label={`Project: ${activeProject?.name ?? 'No project'}`}
          aria-haspopup="menu"
          aria-expanded={projectMenuOpen}
          onClick={() => setProjectMenuOpen((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-sm font-medium rounded hover:bg-hover-tint"
        >
          {activeProject?.name ?? 'No project'}
          <span className="text-xs opacity-50">▾</span>
        </button>
        {projectMenuOpen && (
          <div
            role="menu"
            aria-label="project-switcher"
            className="absolute top-full left-0 mt-1 min-w-40 bg-surface border border-border rounded shadow-lg z-dropdown"
          >
            {projects.map((p) => (
              <button
                key={p.cwd}
                type="button"
                role="menuitem"
                data-active={p.cwd === activeProjectCwd || undefined}
                onClick={() => {
                  onSelectProject(p.cwd);
                  setProjectMenuOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-hover-tint',
                  p.cwd === activeProjectCwd && 'font-medium',
                )}
              >
                <span className="w-3 text-accent">{p.cwd === activeProjectCwd ? '✓' : ''}</span>
                {p.name}
              </button>
            ))}
            <div className="border-t border-border my-1" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onAddProject();
                setProjectMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-hover-tint"
            >
              <span className="w-3">+</span>
              Add project
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* New session picker */}
        <div ref={sessionPickerRef} className="relative">
          <button
            type="button"
            aria-label="New session"
            aria-haspopup="menu"
            aria-expanded={sessionPickerOpen}
            onClick={() => setSessionPickerOpen((v) => !v)}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-hover-tint text-muted hover:text-text"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          {sessionPickerOpen && (
            <div
              role="menu"
              aria-label="New session in..."
              className="absolute top-full right-0 mt-1 min-w-44 bg-surface border border-border rounded shadow-lg z-dropdown"
            >
              <div className="px-3 py-1.5 text-xs text-muted font-medium">New session in...</div>
              {worktrees.map((wt) => (
                <button
                  key={wt.path}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onNewSession(wt.path);
                    setSessionPickerOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-hover-tint"
                >
                  <span className="font-mono text-xs opacity-60">⎇</span>
                  {wt.branch}
                </button>
              ))}
              {onCreateWorktree && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onCreateWorktree();
                      setSessionPickerOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-hover-tint"
                  >
                    <span className="w-3">+</span>
                    New worktree
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Search"
          onClick={onOpenSearch}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-hover-tint text-muted hover:text-text"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-label="Settings"
          onClick={onOpenSettings}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-hover-tint text-muted hover:text-text"
        >
          <Cog6ToothIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
