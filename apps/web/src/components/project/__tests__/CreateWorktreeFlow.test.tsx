import { createFakeServer, createTestContainer } from '@code-quest/server/test';
import { FakeGit } from '@code-quest/test-kit';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('Create Worktree end-to-end flow (right-click → dialog → new tab)', () => {
  it('right-click ProjectCard → Create Worktree… → fill name → submit → new tab in same Project', async () => {
    // Arrange: FakeGit reports /projects/app as the git root for any cwd under it.
    const fakeGit = new FakeGit();
    fakeGit.setProjectRoot('/projects/app');
    const container = createTestContainer({ gitService: fakeGit });
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);
    const { user, addProject } = await renderWithWorkspace({ summoner });

    const project = await addProject({ path: '/projects', dirName: 'app' });
    await project.launchSession();

    // Sanity: 1 tab.
    expect(screen.getAllByLabelText(/^Close /)).toHaveLength(1);

    // Act: right-click the ProjectCard (in the sidebar — disambiguates from
    // the TopScopeSwitcher trigger which also shows project name).
    const sidebar = screen.getByRole('complementary', { name: 'sidebar-panel' });
    const projectButton = await within(sidebar).findByRole('button', { name: /app/i });
    await user.pointer({ keys: '[MouseRight>]', target: projectButton });

    // "Create Worktree…" menu item appears.
    const menuItem = await screen.findByRole('menuitem', { name: /Create Worktree/i });
    expect(menuItem).toBeInTheDocument();
    void sidebar;

    // Click it → dialog opens (2-tab redesign, Phase 10.8c).
    await user.click(menuItem);
    expect(await screen.findByRole('dialog', { name: /new worktree/i })).toBeInTheDocument();

    // Switch to "Create new branch" tab and fill the branch name.
    await user.click(screen.getByRole('tab', { name: /create new branch/i }));
    await user.type(screen.getByLabelText(/new branch name/i), 'feat-a');
    await user.click(screen.getByRole('button', { name: /^Create$/ }));

    // Assert: dialog closes; tab count UNCHANGED (creating a worktree no
    // longer auto-spawns a chat session — user clicks the worktree row
    // separately to open chat).
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /new worktree/i })).not.toBeInTheDocument();
    });
    expect(screen.getAllByLabelText(/^Close /)).toHaveLength(1);
  });
});
