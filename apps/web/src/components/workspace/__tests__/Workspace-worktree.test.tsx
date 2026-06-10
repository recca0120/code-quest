import type { CreateWorktreeResponse } from '@code-quest/schemas';
import { createFakeServer, createTestContainer } from '@code-quest/server/test';
import { FakeGit } from '@code-quest/test-kit';
import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('Workspace worktree grouping', () => {
  it('git:worktree:add is a pure git op — it does NOT auto-spawn a chat tab', async () => {
    // FakeGit: any cwd under /projects/app (including worktrees) reports
    // projectRoot === /projects/app, so server + client group them together.
    const fakeGit = new FakeGit();
    fakeGit.setProjectRoot('/projects/app');
    const container = createTestContainer({ gitService: fakeGit });
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);
    const { addProject } = await renderWithWorkspace({ summoner });

    const project = await addProject({ path: '/projects', dirName: 'app' });
    await project.launchSession();

    // Sanity: chat panel is showing (one active session).
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();

    const socket = summoner.socket;
    let resp: CreateWorktreeResponse | null = null;
    await act(async () => {
      resp = await new Promise<CreateWorktreeResponse>((resolve) => {
        socket.emit(
          'git:worktree:add',
          { cwd: '/projects/app', name: 'feat-a' },
          (r: CreateWorktreeResponse) => resolve(r),
        );
      });
    });
    expect(resp!.ok).toBe(true);

    // Chat panel stays showing the original session — no new session spawned.
    // (User opens chat by clicking the worktree [+] button in the sidebar.)
    await act(async () => {});
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });
});
