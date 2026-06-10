import { createContext, useContext } from 'react';

/**
 * Workspace-level callbacks needed by pane bodies. Stable functions only — data
 * (tabs map, worktree listing) must come from its own narrow context/hook so a
 * status tick or ratio drag never churns every pane (pane-tree D5).
 */
export interface PaneEnvironment {
  onToggleLeft?: () => void;
  onNewTab: (opts?: {
    cwd?: string;
    projectCwd?: string;
    branch?: string;
    targetPaneId?: string;
  }) => void;
  onOpenModal?: (paneId?: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
}

const DEFAULT_ENV: PaneEnvironment = { onNewTab: () => {} };

const PaneEnvironmentContext: React.Context<PaneEnvironment> =
  createContext<PaneEnvironment>(DEFAULT_ENV);

export function usePaneEnvironment(): PaneEnvironment {
  return useContext(PaneEnvironmentContext);
}

export const PaneEnvironmentProvider: React.Provider<PaneEnvironment> =
  PaneEnvironmentContext.Provider;
