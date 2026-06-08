import { FolderOpenIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CommandPaletteProvider, useCommandPaletteActions } from '@/contexts/CommandPaletteContext';
import { useGitState } from '@/contexts/GitContext';
import { useNavigationState } from '@/contexts/NavigationContext';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import { TabProvider } from '@/contexts/TabContext';
import { NO_FORM } from '@/utils/hotkey-options';
import { CommandPalette } from '../palette/CommandPalette.tsx';
import { AddProjectDialog } from '../project/AddProjectDialog.tsx';
import { CreateWorktreeDialog } from '../project/CreateWorktreeDialog.tsx';
import { SettingsDialog } from '../settings/SettingsDialog.tsx';
import { GlobalBar } from './GlobalBar.tsx';
import { TabContainer } from './TabContainer.tsx';

const ADD_PROJECT_ERRORS: Record<string, (p: string) => string> = {
  path_not_found: (p) => `Path not found: ${p}`,
  path_not_directory: (p) => `Not a directory: ${p}`,
};

function DocumentTitle({ sessions }: { sessions: Array<{ state: string }> }) {
  const isBusy = sessions.some((s) => s.state === 'busy');
  useEffect(() => {
    document.title = isBusy ? '⟳ Code Quest' : 'Code Quest';
  }, [isBusy]);
  return null;
}

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
  const [worktreeDialogOpen, setWorktreeDialogOpen] = useState(false);
  const [pendingSession, setPendingSession] = useState<{
    projectCwd: string;
    sessionCwd: string;
  } | null>(null);

  useEffect(() => {
    registerActions({
      onAddProject: () => setDialogOpen(true),
      onOpenSettings: () => setSettingsOpen(true),
    });
  }, [registerActions]);

  const { projects, activeProjectCwd } = useProjectState();
  const { sessions } = useSession();
  const { selectedWorktreeCwd } = useNavigationState();
  const { addProject, setActiveProject } = useProjectActions();
  const { listing } = useGitState();

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

  const addedProjectCwds = useMemo(() => new Set(projects.map((p) => p.cwd)), [projects]);

  const activeWorktrees = useMemo(() => {
    if (!activeProjectCwd) return [];
    const entry = listing[activeProjectCwd];
    if (!Array.isArray(entry)) return [];
    return entry;
  }, [listing, activeProjectCwd]);

  const projectList = useMemo(
    () => projects.map((p) => ({ cwd: p.cwd, name: p.name })),
    [projects],
  );

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
          <GlobalBar
            projects={projectList}
            activeProjectCwd={activeProjectCwd}
            worktrees={activeWorktrees}
            onSelectProject={(cwd) => setActiveProject(cwd)}
            onAddProject={() => setDialogOpen(true)}
            onNewSession={(cwd) => {
              const matchingProject = projects.find((p) => cwd.startsWith(p.cwd));
              if (matchingProject) {
                setActiveProject(matchingProject.cwd);
                setPendingSession({ projectCwd: matchingProject.cwd, sessionCwd: cwd });
              }
            }}
            onCreateWorktree={() => setWorktreeDialogOpen(true)}
            onOpenSearch={() => openPalette()}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <TabProvider
            sessions={sessions}
            cwd={activeProjectCwd ?? undefined}
            selectedCwd={
              activeProjectCwd ? (selectedWorktreeCwd[activeProjectCwd] ?? undefined) : undefined
            }
          >
            <main aria-label="project-container" className="flex flex-1 min-w-0 overflow-hidden">
              <TabContainer
                projectCwd={activeProjectCwd ?? ''}
                pendingNewSessionCwd={pendingSession?.sessionCwd ?? null}
                onSessionCreated={() => setPendingSession(null)}
              />
            </main>
          </TabProvider>
        </>
      )}
      <AddProjectDialog
        open={dialogOpen}
        onSelect={handleAddProject}
        onClose={() => setDialogOpen(false)}
        addedProjectCwds={addedProjectCwds}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {worktreeDialogOpen && activeProjectCwd && (
        <CreateWorktreeDialog
          open
          cwd={activeProjectCwd}
          onClose={() => setWorktreeDialogOpen(false)}
        />
      )}
    </div>
  );
}
