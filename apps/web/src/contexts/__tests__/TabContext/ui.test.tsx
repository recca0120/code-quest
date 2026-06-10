import { segments as s } from '@code-quest/test-kit';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, useTabActions, useTabState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

function renderInTab(ui: ReactElement) {
  const summoner = createFakeSummoner();
  const user = userEvent.setup();
  render(
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{ui}</TabProvider>
    </SocketProvider>,
  );
  return { claude: summoner.claude(), user };
}

describe('TabProvider', () => {
  describe('tab bar UI', () => {
    it('renders tab bar after adding project', async () => {
      const { addProject } = await renderWithWorkspace();
      await addProject({ path: '/projects', dirName: 'my-app' });
      expect(screen.getByRole('button', { name: /New Session/ })).toBeInTheDocument();
    });

    it('session is visible after launch', async () => {
      const { addProject: addProj } = await renderWithWorkspace();
      const proj = await addProj();
      await proj.launchSession();
      expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    });
  });

  describe('document title', () => {
    it('shows spinner prefix when session is busy and returns to base on idle', async () => {
      const { claude, user, addProject } = await renderWithWorkspace();
      const project = await addProject();
      await project.launchSession();
      const textarea = screen.getByPlaceholderText(/Esc to focus/i);
      await user.click(textarea);
      await user.type(textarea, 'hello');
      await user.keyboard('{Enter}');

      expect(document.title).toBe('⟳ Code Quest');

      await act(async () => {
        await claude.emitSegment(s.result());
      });
      expect(document.title).toBe('Code Quest');
    });
  });

  describe('socket events', () => {
    it('addTab activates first tab when no active tab', async () => {
      function Test() {
        const { tabs, activeTabId } = useTabState();
        const { addTab } = useTabActions();
        return (
          <>
            <span role="status" aria-label="active">
              {activeTabId ?? 'null'}
            </span>
            <span role="status" aria-label="count">
              {Object.keys(tabs).length}
            </span>
            <button type="button" onClick={() => addTab('remote-ch')}>
              add
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);

      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('null');

      await user.click(screen.getByText('add'));

      expect(screen.getByRole('status', { name: 'count' })).toHaveTextContent('1');
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('remote-ch');
    });

    it('launching a session does not create duplicate tabs', async () => {
      const { claude, addProject: addProj } = await renderWithWorkspace();
      const proj = await addProj();
      await proj.launchSession();
      // Emit assistant turn to ensure session is stable
      await act(async () => {
        await claude.emitSegment(s.result());
      });
      // Only one session panel should be visible
      expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(1);
    });

    it('session:created with cwd auto-creates project and tab remains visible', async () => {
      const { addProject: addProj } = await renderWithWorkspace();
      const proj = await addProj();
      await proj.launchSession();

      // After renderWithWorkspace, session:created was broadcast with cwd
      // → deriveProjects should have created a project
      // → Workspace should render project path with TabProvider(sessions)
      // → Tab should be visible in project's TabContainer
      expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    });

    it('workspace remains visible after session becomes dead', async () => {
      const { claude, addProject } = await renderWithWorkspace();
      const project = await addProject();
      await project.launchSession();
      await act(async () => {
        await claude.emitSegment(s.resultResumeNotFound({ errors: ['No conversation found'] }));
      });
      await act(async () => {
        claude.handle.abort();
      });

      expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    });
  });
});
