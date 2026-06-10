/**
 * Session Manager Overlay O.1–O.5
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { GitProvider } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import {
  TabProvider,
  usePaneActions,
  usePaneState,
  useTabActions,
  useWorkspaceTab,
} from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <ProjectProvider>
        <GitProvider>
          <TabProvider>
            <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
          </TabProvider>
        </GitProvider>
      </ProjectProvider>
    </SocketProvider>
  );
}

// O.1: ⌘⇧M opens Session Manager overlay
describe('SessionManager (O.1) ⌘⇧M opens overlay', () => {
  it('⌘⇧M shows session manager overlay', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');

    expect(screen.getByTestId('session-manager')).toBeInTheDocument();
  });

  it('pressing ⌘⇧M again closes the overlay', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');
    expect(screen.getByTestId('session-manager')).toBeInTheDocument();

    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();
  });

  it('Escape closes the overlay', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');
    expect(screen.getByTestId('session-manager')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();
  });
});

// O.2: Overlay lists all sessions
describe('SessionManager (O.2) overlay lists sessions', () => {
  it('shows all sessions with their names', async () => {
    const user = userEvent.setup();

    function Setup() {
      const { addTab } = useTabActions();
      return (
        <button
          type="button"
          onClick={() => {
            addTab('sess-1', '/project');
            addTab('sess-2', '/project');
          }}
        >
          add sessions
        </button>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'add sessions' }));
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');

    const manager = screen.getByTestId('session-manager');
    expect(manager).toBeInTheDocument();
    // Sessions should be listed
    const items = manager.querySelectorAll('[data-testid^="session-manager-item"]');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});

// O.4: Sessions grouped by workspace tab
describe('SessionManager (O.4) sessions grouped by workspace tab', () => {
  it('shows sessions under their workspace tab group name', async () => {
    const user = userEvent.setup();

    function Setup() {
      const { addTab } = useTabActions();
      const { addWorkspaceTab } = useWorkspaceTab();
      const { setSessionInPane } = usePaneActions();
      const { paneRoot } = usePaneState();
      return (
        <button
          type="button"
          onClick={() => {
            // Session in default tab (Layout 1)
            addTab('sess-layout1', '/project-a');
            const leafId = paneRoot.type === 'leaf' ? paneRoot.id : null;
            if (leafId) setSessionInPane(leafId, 'sess-layout1', null);
            // Add a second workspace tab with a session
            addWorkspaceTab('My Layout');
            addTab('sess-layout2', '/project-b');
          }}
        >
          setup
        </button>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'setup' }));
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');

    const manager = screen.getByTestId('session-manager');
    expect(manager).toBeInTheDocument();
    // Should have a "My Layout" group heading
    expect(manager).toHaveTextContent('My Layout');
  });

  it('shows sessions not in any pane under "No Tab" group', async () => {
    const user = userEvent.setup();

    function Setup() {
      const { addTab } = useTabActions();
      return (
        <button
          type="button"
          onClick={() => {
            // Add a session that is NOT placed in any pane
            addTab('sess-no-tab', '/project-orphan');
          }}
        >
          setup
        </button>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'setup' }));
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');

    const manager = screen.getByTestId('session-manager');
    expect(manager).toBeInTheDocument();
    // Should show "No Tab" section for unassigned session
    expect(manager).toHaveTextContent('No Tab');
    expect(
      manager.querySelector('[data-testid="session-manager-item-sess-no-tab"]'),
    ).toBeInTheDocument();
  });
});

// O.3: Clicking session in overlay fills focused pane
describe('SessionManager (O.3) clicking session fills pane and closes overlay', () => {
  it('clicking a session assigns it to the focused pane', async () => {
    const user = userEvent.setup();
    let leafSessionId: string | null = null;

    function Probe() {
      const { paneRoot } = usePaneState();
      if (paneRoot.type === 'leaf' && paneRoot.content.type === 'session') {
        leafSessionId = paneRoot.content.sessionId ?? null;
      }
      return null;
    }

    function Setup() {
      const { addTab } = useTabActions();
      return (
        <button type="button" onClick={() => addTab('sess-target', '/project')}>
          add session
        </button>
      );
    }

    render(
      <Wrapper>
        <Probe />
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'add session' }));
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');

    const item = screen.getByTestId('session-manager-item-sess-target');
    await user.click(item);

    expect(leafSessionId).toBe('sess-target');
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();
  });
});

// O.5: Projects section
describe('SessionManager (O.5) projects section', () => {
  async function openSessionManager(user: ReturnType<typeof userEvent.setup>) {
    // Wait for the workspace to stabilize (git listing may be async)
    await waitFor(
      () => {
        expect(screen.queryByRole('dialog', { name: /add project/i })).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    // Focus body to ensure keyboard shortcut fires
    document.body.focus();
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');
    return screen.findByTestId('session-manager', {}, { timeout: 3000 });
  }

  it('shows project name and worktrees in Projects section', async () => {
    const { user, addProject } = await renderWithWorkspace();

    await addProject({ path: '/work', dirName: 'myapp' });

    const manager = await openSessionManager(user);
    expect(manager).toBeInTheDocument();
    // Projects section heading
    expect(manager).toHaveTextContent('Projects');
    // Project name
    expect(manager).toHaveTextContent('myapp');
    // Worktree branch
    expect(manager).toHaveTextContent('main');
  });

  it('shows [+ New session] for worktrees without a session', async () => {
    const { user, addProject } = await renderWithWorkspace();

    await addProject({ path: '/work', dirName: 'myapp' });

    const manager = await openSessionManager(user);
    // Worktree has no session → should show "+ New session" button
    expect(manager.querySelector('[data-testid="new-session-btn"]')).toBeInTheDocument();
  });

  it('shows [+ New worktree] button per project', async () => {
    const { user, addProject } = await renderWithWorkspace();

    await addProject({ path: '/work', dirName: 'myapp' });

    const manager = await openSessionManager(user);
    expect(manager.querySelector('[data-testid="new-worktree-btn"]')).toBeInTheDocument();
  });

  it('shows [+ Add project] button', async () => {
    const { user, addProject } = await renderWithWorkspace();

    await addProject({ path: '/work', dirName: 'myapp' });

    const manager = await openSessionManager(user);
    expect(manager.querySelector('[data-testid="add-project-btn"]')).toBeInTheDocument();
  });
});
