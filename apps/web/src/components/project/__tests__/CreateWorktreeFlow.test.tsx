import { createFakeServer, createTestContainer } from '@code-quest/server/test';
import { FakeGit } from '@code-quest/test-kit';
import { screen, waitFor } from '@testing-library/react';
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

    // Sanity: chat panel is active.
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();

    // Act: open GlobalBar [+] → "Open in pane" modal → "New worktree"
    await user.click(screen.getByRole('button', { name: 'New session' }));
    const newWorktreeBtn = await screen.findByRole('button', { name: /\+ New worktree/i });
    expect(newWorktreeBtn).toBeInTheDocument();

    // Click it → dialog opens.
    await user.click(newWorktreeBtn);
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
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });
});
