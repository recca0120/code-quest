import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  useWorkspaceDialogsActions,
  useWorkspaceDialogsState,
  WorkspaceDialogsProvider,
} from '../WorkspaceDialogsContext';

function wrapper({ children }: { children: ReactNode }) {
  return <WorkspaceDialogsProvider>{children}</WorkspaceDialogsProvider>;
}

describe('WorkspaceDialogsContext', () => {
  it('openAddProject sets addProjectOpen to true, closeAddProject resets', () => {
    const { result } = renderHook(
      () => ({ state: useWorkspaceDialogsState(), actions: useWorkspaceDialogsActions() }),
      { wrapper },
    );

    expect(result.current.state.addProjectOpen).toBe(false);
    act(() => result.current.actions.openAddProject());
    expect(result.current.state.addProjectOpen).toBe(true);
    act(() => result.current.actions.closeAddProject());
    expect(result.current.state.addProjectOpen).toBe(false);
  });

  it('openSettings sets settingsOpen to true, closeSettings resets', () => {
    const { result } = renderHook(
      () => ({ state: useWorkspaceDialogsState(), actions: useWorkspaceDialogsActions() }),
      { wrapper },
    );

    expect(result.current.state.settingsOpen).toBe(false);
    act(() => result.current.actions.openSettings());
    expect(result.current.state.settingsOpen).toBe(true);
    act(() => result.current.actions.closeSettings());
    expect(result.current.state.settingsOpen).toBe(false);
  });

  it('openCreateWorktree sets cwd and open, closeCreateWorktree resets both', () => {
    const { result } = renderHook(
      () => ({ state: useWorkspaceDialogsState(), actions: useWorkspaceDialogsActions() }),
      { wrapper },
    );

    expect(result.current.state.createWorktreeOpen).toBe(false);
    expect(result.current.state.createWorktreeCwd).toBeNull();

    act(() => result.current.actions.openCreateWorktree('/my/project'));
    expect(result.current.state.createWorktreeOpen).toBe(true);
    expect(result.current.state.createWorktreeCwd).toBe('/my/project');

    act(() => result.current.actions.closeCreateWorktree());
    expect(result.current.state.createWorktreeOpen).toBe(false);
    expect(result.current.state.createWorktreeCwd).toBeNull();
  });
});
