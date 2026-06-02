import { ChevronDownIcon, FolderIcon, PlusIcon } from '@heroicons/react/24/outline';
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import type { Project } from '@/contexts/ProjectContext';
import { basename } from '@/utils/basename';
import { cn } from '@/utils/cn';
import { focusRing } from '../ui/_tokens.ts';
import { MenuItem } from '../ui/MenuItem.tsx';
import { SectionLabel } from '../ui/SectionLabel.tsx';
import { byLastOpenedDesc } from './project-utils.ts';

function displayName(p: Project): string {
  if (p.name.includes('/')) return basename(p.name);
  return p.name || basename(p.cwd);
}

function matchesSearch(p: Project, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return displayName(p).toLowerCase().includes(needle) || p.cwd.toLowerCase().includes(needle);
}

export function TopScopeSwitcher({
  projects,
  activeProjectCwd,
  onSelect,
  onAddProject,
}: {
  projects: Project[];
  activeProjectCwd: string | null;
  onSelect: (cwd: string) => void;
  onAddProject: () => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const active = projects.find((p) => p.cwd === activeProjectCwd) ?? null;

  // Reset search when popover closes so reopening starts fresh.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch('');
  };

  const filtered = projects.filter((p) => matchesSearch(p, search));
  const pinned = filtered.filter((p) => p.pinned).sort(byLastOpenedDesc);
  const recent = filtered.filter((p) => !p.pinned).sort(byLastOpenedDesc);

  function handleSelect(cwd: string) {
    onSelect(cwd);
    setOpen(false);
  }

  function handleAdd() {
    onAddProject();
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-surface hover:border-accent text-text text-xs font-medium"
          aria-haspopup="listbox"
        >
          <FolderIcon className="w-3.5 h-3.5 text-muted" />
          <span className="truncate max-w-50">
            {active ? displayName(active) : 'No project selected'}
          </span>
          <ChevronDownIcon className="w-3.5 h-3.5 text-muted" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="w-72 z-modal rounded border border-border bg-surface shadow-floating flex flex-col max-h-96"
        >
          {/* Inner role="listbox" preserves the listbox semantic + test query
              shape; Radix's Popover.Content carries role="dialog" by default
              for the floating layer itself. */}
          <div role="listbox" className="flex flex-col flex-1 min-h-0">
            <div className="p-2 border-b border-border">
              <input
                type="search"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full px-2 py-1 text-sm rounded bg-bg border border-border text-text outline-none focus:border-accent',
                  focusRing,
                )}
              />
            </div>

            <div className="flex-1 overflow-auto py-1">
              {pinned.length === 0 && recent.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted text-center">No matches</div>
              ) : null}

              {pinned.length > 0 && (
                <>
                  <SectionLabel className="px-3 pt-1 pb-0.5">Pinned</SectionLabel>
                  {pinned.map((p) => (
                    <ScopeItem
                      key={p.cwd}
                      project={p}
                      active={p.cwd === activeProjectCwd}
                      onSelect={handleSelect}
                    />
                  ))}
                </>
              )}

              {recent.length > 0 && (
                <>
                  <SectionLabel className="px-3 pt-2 pb-0.5">Recent</SectionLabel>
                  {recent.map((p) => (
                    <ScopeItem
                      key={p.cwd}
                      project={p}
                      active={p.cwd === activeProjectCwd}
                      onSelect={handleSelect}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={handleAdd}
                className="w-full text-left px-3 py-1.5 rounded text-sm text-accent hover:bg-accent/10 flex items-center gap-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add project
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ScopeItem({
  project,
  active,
  onSelect,
}: {
  project: Project;
  active: boolean;
  onSelect: (cwd: string) => void;
}) {
  return (
    <MenuItem
      onClick={() => onSelect(project.cwd)}
      title={project.cwd}
      className={cn(
        'flex items-center gap-1.5 py-1',
        active ? 'text-accent bg-accent/10 hover:bg-accent/10' : '',
      )}
    >
      <FolderIcon className="w-3.5 h-3.5 shrink-0 text-muted" />
      <span className="truncate flex-1">{displayName(project)}</span>
    </MenuItem>
  );
}
