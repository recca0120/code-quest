import { FolderOpenIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { DrawerAside } from '@/components/ui/DrawerAside';
import { EmptyState } from '@/components/ui/EmptyState';
import { CommandPaletteProvider, useCommandPaletteActions } from '@/contexts/CommandPaletteContext';
import { useNavigationState } from '@/contexts/NavigationContext';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import { TabProvider } from '@/contexts/TabContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/utils/cn';
import { NO_FORM } from '@/utils/hotkey-options';
import { CommandPalette } from '../palette/CommandPalette.tsx';
import { AddProjectDialog } from '../project/AddProjectDialog.tsx';
import { ProjectTree } from '../project/ProjectTree.tsx';
import { SettingsDialog } from '../settings/SettingsDialog.tsx';
import { TabContainer } from './TabContainer.tsx';
import { WorkspaceTopbar } from './WorkspaceTopbar.tsx';

function DocumentTitle({ sessions }: { sessions: Array<{ state: string }> }) {
  const isBusy = sessions.some((s) => s.state === 'busy');
  useEffect(() => {
    document.title = isBusy ? '⟳ Code Quest' : 'Code Quest';
  }, [isBusy]);
  return null;
}

/**
 * Workspace shell — single component tree across all viewport widths. The
 * sidebar and right pane are mounted exactly once each; CSS responsive
 * modifiers decide whether they appear as docked columns (lg+) or as
 * fixed-positioned slide-in drawers (<lg). This preserves component-local
 * state (file-tree expansion, scroll, draft text, etc.) when the user
 * resizes across the 768/1024 breakpoints.
 *
 * Resize-to-taste of the sidebar / right-pane widths is intentionally
 * deferred — the previous react-resizable-panels integration was the
 * source of the breakpoint-state-loss bug because Panels can't be both a
 * docked column and a fixed-positioned drawer.
 */
export function WorkspaceLayout(): React.JSX.Element {
  return (
    <CommandPaletteProvider>
      <WorkspaceLayoutInner />
    </CommandPaletteProvider>
  );
}

function WorkspaceLayoutInner() {
  const { openPalette, registerActions } = useCommandPaletteActions();
  useHotkeys('mod+k', () => openPalette(), NO_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    registerActions({
      onAddProject: () => setDialogOpen(true),
      onOpenSettings: () => setSettingsOpen(true),
    });
  }, [registerActions]);
  const { projects, activeProjectCwd } = useProjectState();
  const { sessions, sessionsMap } = useSession();
  const { selectedWorktreeCwd } = useNavigationState();
  const { addProject, setActiveProject } = useProjectActions();
  const { isMobile, isDesktop } = useBreakpoint();
  const [leftOpen, setLeftOpen] = useState(() => isDesktop);

  const ADD_PROJECT_ERRORS: Record<string, (p: string) => string> = {
    path_not_found: (p) => `Path not found: ${p}`,
    path_not_directory: (p) => `Not a directory: ${p}`,
  };

  async function handleAddProject(cwd: string) {
    const res = await addProject(cwd);
    if ('error' in res) {
      const p = res.path ?? cwd;
      const msg = ADD_PROJECT_ERRORS[res.error]?.(p) ?? `Could not add project (${res.error})`;
      toast.error(msg);
      return;
    }
    setDialogOpen(false);
  }

  const handleActivateSession = useCallback(
    (channelId: string) => {
      const s = sessionsMap.get(channelId);
      if (s) setActiveProject(s.projectRoot);
    },
    [sessionsMap, setActiveProject],
  );

  const onToggleLeft = useCallback(() => setLeftOpen((v) => !v), []);
  const addedProjectCwds = useMemo(() => new Set(projects.map((p) => p.cwd)), [projects]);
  const sessionsByProject = useMemo(() => {
    const m = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const list = m.get(s.projectRoot) ?? [];
      list.push(s);
      m.set(s.projectRoot, list);
    }
    return m;
  }, [sessions]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <CommandPalette />
      <DocumentTitle sessions={sessions} />
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpenIcon className="w-10 h-10" />}
          message="No projects yet"
          actionLabel="Add Project"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <>
          <WorkspaceTopbar
            mode={isMobile ? 'mobile' : 'desktop'}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenSearch={() => openPalette()}
            onToggleLeft={onToggleLeft}
            sessions={sessions}
            onActivateSession={handleActivateSession}
          />
          <div className="relative flex flex-1 overflow-hidden">
            {leftOpen && (
              <button
                type="button"
                aria-label="Dismiss sidebar"
                onClick={() => setLeftOpen(false)}
                className="lg:hidden fixed inset-0 z-overlay bg-overlay"
              />
            )}
            <DrawerAside
              side="left"
              open={leftOpen}
              mobileWidthClass="w-[min(85vw,320px)]"
              dockedWidthClass="lg:w-65"
              label="sidebar-panel"
              closeLabel="sidebar"
              onClose={() => setLeftOpen(false)}
            >
              <ProjectTree
                projects={projects}
                activeProjectCwd={activeProjectCwd}
                onSelectProject={(cwd) => {
                  setActiveProject(cwd);
                  if (!isDesktop) setLeftOpen(false);
                }}
                onAdd={() => setDialogOpen(true)}
              />
            </DrawerAside>

            <main className="flex flex-1 min-w-0 h-full">
              {projects.map((project) => (
                <section
                  key={project.cwd}
                  aria-label={project.cwd === activeProjectCwd ? 'project-container' : undefined}
                  className={cn(
                    project.cwd === activeProjectCwd ? 'flex flex-1 min-w-0 h-full' : 'hidden',
                  )}
                >
                  <TabProvider
                    sessions={sessionsByProject.get(project.cwd) ?? []}
                    cwd={project.cwd}
                    selectedCwd={selectedWorktreeCwd[project.cwd] ?? undefined}
                  >
                    <TabContainer projectCwd={project.cwd} onToggleLeft={onToggleLeft} />
                  </TabProvider>
                </section>
              ))}
            </main>
          </div>
        </>
      )}
      <AddProjectDialog
        open={dialogOpen}
        onSelect={handleAddProject}
        onClose={() => setDialogOpen(false)}
        addedProjectCwds={addedProjectCwds}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
