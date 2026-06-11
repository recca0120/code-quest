import { createFakeServer, createTestContainer } from '@code-quest/server/test';
import { FakeGit } from '@code-quest/test-kit';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { COMPOSE_PLACEHOLDER } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('Create Worktree end-to-end flow (dialog → session in new worktree)', () => {
  it('SessionManager (⌘⇧M) → + New worktree → fill name → submit → session opens in new worktree', async () => {
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
    expect(screen.getByPlaceholderText(COMPOSE_PLACEHOLDER)).toBeInTheDocument();

    // Act: SessionManager (⌘⇧M) → "+ New worktree"
    // (SessionBar 的 [+] dropdown 已由 tmux-workspace-ui P1 移除)
    await user.keyboard('{Meta>}{Shift>}M{/Shift}{/Meta}');
    await screen.findByTestId('session-manager');
    const newWorktreeBtn = await screen.findByTestId('new-worktree-btn');

    // Click it → dialog opens.
    await user.click(newWorktreeBtn);
    expect(await screen.findByRole('dialog', { name: /new worktree/i })).toBeInTheDocument();

    // Switch to "Create new branch" tab and fill the branch name.
    await user.click(screen.getByRole('tab', { name: /create new branch/i }));
    await user.type(screen.getByLabelText(/new branch name/i), 'feat-a');
    await user.click(screen.getByRole('button', { name: /^Create$/ }));

    // Assert ①: dialog closes AND a session opens in the new worktree
    // (worktree-centric entry-wiring: the create-worktree dead-end is gone —
    // coming from a new-session flow continues straight into a session).
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /new worktree/i })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText(COMPOSE_PLACEHOLDER).length).toBe(2);
    });

    // Assert ②: client→server RPC layer — worktree create + launch in the new path.
    const newWorktreePath = '/projects/app/.claude/worktrees/feat-a';
    const creates = summoner.sentEvents('git:worktree:add');
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({
      cwd: '/projects/app',
      newBranch: 'feat-a',
      path: newWorktreePath,
    });
    const launches = summoner.sentEvents('session:launch');
    expect(launches.at(-1)).toMatchObject({ cwd: newWorktreePath });
  });
});
