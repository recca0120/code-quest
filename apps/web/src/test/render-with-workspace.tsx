/* biome-ignore-all lint/suspicious/noExplicitAny: test harness */

import { EVENTS } from '@code-quest/schemas';
import type { FakeClaude } from '@code-quest/test-kit';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
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

  // Detect entry point: empty state "New Session" button or sidebar worktree [+]
  const emptyButton = screen.queryByRole('button', { name: /New Session/ });
  if (emptyButton) {
    await user.click(emptyButton);
  } else {
    const openNewChatBtns = screen.queryAllByLabelText('Open new chat');
    if (openNewChatBtns.length > 0) {
      await user.click(openNewChatBtns[0]!);
    } else {
      // Fallback: use empty-state New Session if worktree [+] not yet visible
      const fallback = await screen.findByRole('button', { name: /New Session/ });
      await user.click(fallback);
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

  summoner.filesystem().setRoots([path]);
  summoner.filesystem().addDirectory(path, [dirName]);

  // Detect entry point: EmptyState or sidebar
  const emptyButton = screen.queryByRole('button', { name: 'Add Project' });
  if (emptyButton) {
    await user.click(emptyButton);
  } else {
    const sidebar = screen.getByRole('complementary', { name: 'sidebar-panel' });
    await user.click(within(sidebar).getByText(/Add/));
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
  const summoner = opts?.summoner ?? createFakeSummoner();
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
