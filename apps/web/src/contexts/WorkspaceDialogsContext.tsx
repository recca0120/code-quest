import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

interface WorkspaceDialogsState {
  addProjectOpen: boolean;
  settingsOpen: boolean;
  createWorktreeOpen: boolean;
  createWorktreeCwd: string | null;
}

interface WorkspaceDialogsActions {
  openAddProject: () => void;
  openSettings: () => void;
  openCreateWorktree: (projectCwd: string) => void;
  closeAddProject: () => void;
  closeSettings: () => void;
  closeCreateWorktree: () => void;
}

const StateContext = createContext<WorkspaceDialogsState | null>(null);
const ActionsContext = createContext<WorkspaceDialogsActions | null>(null);

export function useWorkspaceDialogsState(): WorkspaceDialogsState {
  const ctx = useContext(StateContext);
  if (!ctx)
    throw new Error('useWorkspaceDialogsState must be used within WorkspaceDialogsProvider');
  return ctx;
}

export function useWorkspaceDialogsActions(): WorkspaceDialogsActions {
  const ctx = useContext(ActionsContext);
  if (!ctx)
    throw new Error('useWorkspaceDialogsActions must be used within WorkspaceDialogsProvider');
  return ctx;
}

export function WorkspaceDialogsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createWorktreeOpen, setCreateWorktreeOpen] = useState(false);
  const [createWorktreeCwd, setCreateWorktreeCwd] = useState<string | null>(null);

  const state = useMemo<WorkspaceDialogsState>(
    () => ({ addProjectOpen, settingsOpen, createWorktreeOpen, createWorktreeCwd }),
    [addProjectOpen, settingsOpen, createWorktreeOpen, createWorktreeCwd],
  );

  const actions = useMemo<WorkspaceDialogsActions>(
    () => ({
      openAddProject: () => setAddProjectOpen(true),
      openSettings: () => setSettingsOpen(true),
      openCreateWorktree: (cwd: string) => {
        setCreateWorktreeCwd(cwd);
        setCreateWorktreeOpen(true);
      },
      closeAddProject: () => setAddProjectOpen(false),
      closeSettings: () => setSettingsOpen(false),
      closeCreateWorktree: () => {
        setCreateWorktreeOpen(false);
        setCreateWorktreeCwd(null);
      },
    }),
    [],
  );

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  );
}
