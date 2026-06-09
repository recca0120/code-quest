/* biome-ignore-all lint/suspicious/noExplicitAny: test harness */

import { EVENTS } from '@code-quest/schemas';
import { createFakeServer } from '@code-quest/server/test';
import type { FakeClaude } from '@code-quest/test-kit';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { onTestFinished } from 'vitest';
import { WorkspaceLayout } from '../components/workspace/WorkspaceLayout.tsx';
import { AppInitProvider } from '../contexts/AppInitContext.tsx';
import { FsProvider } from '../contexts/FsContext.tsx';
import { GitProvider } from '../contexts/GitContext.tsx';
import { NavigationProvider } from '../contexts/NavigationContext.tsx';
import { OpenspecProvider } from '../contexts/OpenspecContext.tsx';
import { PluginProvider } from '../contexts/PluginContext.tsx';
import { ProjectProvider } from '../contexts/ProjectContext.tsx';
import { SessionProvider } from '../contexts/SessionContext.tsx';
import { SocketProvider } from '../contexts/SocketContext.tsx';
import { createFakeSummoner, type FakeSummoner } from './fake-summoner.ts';

interface RenderWithWorkspaceOptions {
  summoner?: FakeSummoner;
}

export interface RenderWithWorkspaceResult {
  claude: FakeClaude;
  summoner: FakeSummoner;
  user: ReturnType<typeof userEvent.setup>;
  unmount: () => void;
  addProject: (opts?: {
    path?: string;
    dirName?: string;
  }) => Promise<{ launchSession: () => Promise<string> }>;
}

/** Launch a new session (click "New tab" → await session init). */
async function launchSession(
  user: ReturnType<typeof userEvent.setup>,
  summoner: FakeSummoner,
): Promise<string> {
  let channelId = '';
  const initPromise = new Promise<string>((resolve) => {
    summoner.on(EVENTS.session.init, (p: any) => {
      if (!channelId) {
        channelId = p.channelId;
        resolve(p.channelId);
      }
    });
  });

  // Entry point A: "New Session" EmptyState button → opens modal → click "+ New session"
  const emptyStateBtn = screen.queryByRole('button', { name: 'New Session' });
  if (emptyStateBtn) {
    await user.click(emptyStateBtn);
    const newSessionBtns = await screen.findAllByRole(
      'button',
      { name: /\+ New session/i },
      { timeout: 5000 },
    );
    await user.click(newSessionBtns[0]!);
  } else {
    // Entry point B: SessionBar [+] "New session" → inline dropdown → click worktree
    const dropdownBtn = await screen.findByRole('button', { name: 'New session' });
    await user.click(dropdownBtn);
    const dropdown = await screen.findByTestId('new-session-dropdown', {}, { timeout: 3000 });
    const worktreeBtns = dropdown.querySelectorAll('button');
    if (worktreeBtns.length > 0) {
      await user.click(worktreeBtns[0]!);
    }
  }

  await act(async () => {
    channelId = await initPromise;
  });

  await screen.findAllByPlaceholderText(/Esc to focus/i);

  return channelId;
}

/**
 * Add a project via AddProjectDialog UI flow.
 * Handles both entry points: EmptyState (no projects) and sidebar "+" (has projects).
 */
async function addProject(
  user: ReturnType<typeof userEvent.setup>,
  summoner: FakeSummoner,
  opts?: { path?: string; dirName?: string },
): Promise<{ launchSession: () => Promise<string> }> {
  const path = opts?.path ?? '/projects';
  const dirName = opts?.dirName ?? 'app';

  const projectCwd = `${path}/${dirName}`;
  summoner.filesystem().setRoots([path]);
  summoner.filesystem().addDirectory(path, [dirName]);

  // Set up git worktree before project is added so GitContext can fetch it on project:added
  const git = summoner.git();
  if (git) {
    git.markAsRepo(projectCwd);
    git.setProjectRoot(projectCwd);
    git.addWorktree({ path: projectCwd, branch: 'main', name: dirName });
  }

  // Detect entry point: EmptyState "Add Project" or WorkspaceTabBar "Add project"
  const emptyButton = screen.queryByRole('button', { name: 'Add Project' });
  if (emptyButton) {
    await user.click(emptyButton);
  } else {
    await user.click(screen.getByRole('button', { name: /add project/i }));
  }

  // Browse FileTree → select → Add
  const root = await screen.findByRole('treeitem', { name: path.split('/').pop() });
  await user.click(root);
  const item = await screen.findByRole('treeitem', { name: dirName });
  await user.click(item);
  await user.click(screen.getByRole('button', { name: /^add$/i }));

  return { launchSession: () => launchSession(user, summoner) };
}

export async function renderWithWorkspace(
  opts?: RenderWithWorkspaceOptions,
): Promise<RenderWithWorkspaceResult> {
  const ownedServer = opts?.summoner ? null : createFakeServer();
  const summoner = opts?.summoner ?? createFakeSummoner(ownedServer!);
  onTestFinished(() => ownedServer?.destroy());
  const claude = summoner.claude() as FakeClaude;
  const user = userEvent.setup({ pointerEventsCheck: 0 });

  if (!claude.hasInitSegments) {
    claude.prepareInit();
  }

  const { unmount } = render(
    <SocketProvider socket={summoner.socket}>
      <AppInitProvider>
        <SessionProvider>
          <PluginProvider>
            <ProjectProvider>
              <NavigationProvider>
                <GitProvider>
                  <FsProvider>
                    <OpenspecProvider>
                      <WorkspaceLayout />
                      <Toaster />
                    </OpenspecProvider>
                  </FsProvider>
                </GitProvider>
              </NavigationProvider>
            </ProjectProvider>
          </PluginProvider>
        </SessionProvider>
      </AppInitProvider>
    </SocketProvider>,
  );

  return {
    claude,
    summoner,
    user,
    unmount,
    addProject: (projectOpts?: { path?: string; dirName?: string }) =>
      addProject(user, summoner, projectOpts),
  };
}
