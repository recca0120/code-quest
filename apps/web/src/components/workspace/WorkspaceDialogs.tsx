import { useMemo } from 'react';
import { toast } from 'sonner';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import {
  useWorkspaceDialogsActions,
  useWorkspaceDialogsState,
} from '@/contexts/WorkspaceDialogsContext';
import { AddProjectDialog } from '../project/AddProjectDialog.tsx';
import { CreateWorktreeDialog } from '../project/CreateWorktreeDialog.tsx';
import { SettingsDialog } from '../settings/SettingsDialog.tsx';

const ADD_PROJECT_ERRORS: Record<string, (p: string) => string> = {
  path_not_found: (p) => `Path not found: ${p}`,
  path_not_directory: (p) => `Not a directory: ${p}`,
};

interface WorkspaceDialogsProps {
  onWorktreeCreated?: (projectCwd: string, worktreePath: string) => void;
}

export function WorkspaceDialogs({ onWorktreeCreated }: WorkspaceDialogsProps): React.JSX.Element {
  const { addProjectOpen, settingsOpen, createWorktreeOpen, createWorktreeCwd } =
    useWorkspaceDialogsState();
  const { closeAddProject, closeSettings, closeCreateWorktree } = useWorkspaceDialogsActions();
  const { addProject } = useProjectActions();
  const { projects } = useProjectState();

  const addedProjectCwds = useMemo(() => new Set(projects.map((p) => p.cwd)), [projects]);

  async function handleAddProject(cwd: string) {
    const res = await addProject(cwd);
    if ('error' in res) {
      const p = res.path ?? cwd;
      const msg = ADD_PROJECT_ERRORS[res.error]?.(p) ?? `Could not add project (${res.error})`;
      toast.error(msg);
      return;
    }
    closeAddProject();
  }

  return (
    <>
      <AddProjectDialog
        open={addProjectOpen}
        onSelect={handleAddProject}
        onClose={closeAddProject}
        addedProjectCwds={addedProjectCwds}
      />
      <SettingsDialog open={settingsOpen} onClose={closeSettings} />
      {createWorktreeOpen && createWorktreeCwd && (
        <CreateWorktreeDialog
          open
          cwd={createWorktreeCwd}
          onClose={closeCreateWorktree}
          onCreated={(path) => {
            onWorktreeCreated?.(createWorktreeCwd, path);
          }}
        />
      )}
    </>
  );
}
