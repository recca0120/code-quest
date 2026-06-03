import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useNavigationState } from '@/contexts/NavigationContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { readPersistedRaw } from '@/test/memory-persist-storage';
import { ProjectTree } from '../ProjectTree.tsx';

function makeWrapper() {
  const wrapper = createTestWrapper();
  if (!wrapper.summoner.claude().hasInitSegments) wrapper.summoner.claude().prepareInit();
  return wrapper;
}

describe('ProjectTree', () => {
  it('renders projects in Pinned/Recent groups like ProjectList', () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ProjectTree
          projects={[
            { cwd: '/a', name: 'A', pinned: true, lastOpenedAt: '2025-01-03' },
            { cwd: '/b', name: 'B', pinned: false, lastOpenedAt: '2025-01-02' },
          ]}
          activeProjectCwd={null}
          onSelectProject={() => {}}
          onAdd={() => {}}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/Pinned/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent/i)).toBeInTheDocument();
  });

  it('active project is expanded by default (chevron pointing down)', async () => {
    const { Wrapper, summoner } = makeWrapper();
    summoner.git()!.setProjectRoot('/repo');
    render(
      <Wrapper>
        <ProjectTree
          projects={[{ cwd: '/repo', name: 'repo', pinned: false, lastOpenedAt: '2025-01-01' }]}
          activeProjectCwd="/repo"
          onSelectProject={() => {}}
          onAdd={() => {}}
        />
      </Wrapper>,
    );
    const expandBtn = await screen.findByRole('button', { name: /collapse repo/i });
    expect(expandBtn).toBeInTheDocument();
  });

  it('non-active project is collapsed by default', () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ProjectTree
          projects={[{ cwd: '/other', name: 'other', pinned: false, lastOpenedAt: '2025-01-01' }]}
          activeProjectCwd={null}
          onSelectProject={() => {}}
          onAdd={() => {}}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /expand other/i })).toBeInTheDocument();
  });

  it('clicking chevron expands and fetches worktrees', async () => {
    const { Wrapper, summoner } = makeWrapper();
    summoner.git()!.setProjectRoot('/repo');
    summoner.git()!.addWorktree({
      name: 'feat-x',
      path: '/repo/.claude/worktrees/feat-x',
      branch: 'worktree-feat-x',
    });

    render(
      <Wrapper>
        <ProjectTree
          projects={[{ cwd: '/repo', name: 'repo', pinned: false, lastOpenedAt: '2025-01-01' }]}
          activeProjectCwd={null}
          onSelectProject={() => {}}
          onAdd={() => {}}
        />
      </Wrapper>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /expand repo/i }));

    await waitFor(() => {
      expect(screen.getByText(/feat-x/)).toBeInTheDocument();
    });
  });

  it('non-git project: no chevron after fetch (listing === not_a_repo)', async () => {
    const { Wrapper, summoner } = makeWrapper();
    summoner.git()!.setProjectRoot(null); // non-git

    render(
      <Wrapper>
        <ProjectTree
          projects={[{ cwd: '/notes', name: 'notes', pinned: false, lastOpenedAt: '2025-01-01' }]}
          activeProjectCwd="/notes"
          onSelectProject={() => {}}
          onAdd={() => {}}
        />
      </Wrapper>,
    );

    // After auto-expand tries to fetch, the server responds not_a_repo → chevron hidden
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /expand notes|collapse notes/i })).toBeNull();
    });
  });

  it('expand state persists via zustand persist', async () => {
    const { Wrapper } = makeWrapper();
    const { unmount } = render(
      <Wrapper>
        <ProjectTree
          projects={[{ cwd: '/p', name: 'p', pinned: false, lastOpenedAt: '2025-01-01' }]}
          activeProjectCwd={null}
          onSelectProject={() => {}}
          onAdd={() => {}}
        />
      </Wrapper>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /expand p/i }));
    expect(readPersistedRaw('code-quest:preferences')).toContain('/p');

    unmount();
    // Re-mount — should rehydrate from persisted storage and start expanded
    const { Wrapper: Wrapper2 } = makeWrapper();
    render(
      <Wrapper2>
        <ProjectTree
          projects={[{ cwd: '/p', name: 'p', pinned: false, lastOpenedAt: '2025-01-01' }]}
          activeProjectCwd={null}
          onSelectProject={() => {}}
          onAdd={() => {}}
        />
      </Wrapper2>,
    );
    expect(screen.getByRole('button', { name: /collapse p/i })).toBeInTheDocument();
  });

  describe('Initialize as git repo (Phase 8)', () => {
    it('non-git project shows inline [Initialize as git repo] button', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot(null); // non-git
      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/notes', name: 'notes', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/notes"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      expect(
        await screen.findByRole('button', { name: /initialize as git repo/i }),
      ).toBeInTheDocument();
    });

    it('git project does NOT show inline Initialize button', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot('/repo');
      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/repo', name: 'repo', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/repo"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      // wait for listing to resolve (repo, chevron should appear)
      await screen.findByRole('button', { name: /collapse repo/i });
      expect(screen.queryByRole('button', { name: /initialize as git repo/i })).toBeNull();
    });

    it('non-git project ⋯ menu contains "Initialize as git repo"', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot(null);
      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/notes', name: 'notes', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/notes"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      // Wait for fetch to resolve with not_a_repo
      await screen.findByRole('button', { name: /initialize as git repo/i });
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      expect(
        await screen.findByRole('menuitem', { name: /initialize as git repo/i }),
      ).toBeInTheDocument();
    });

    it('git project ⋯ menu does NOT contain Initialize as git repo', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot('/repo');
      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/repo', name: 'repo', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/repo"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      await screen.findByRole('button', { name: /collapse repo/i });
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      // Menu opens but no Initialize option
      await screen.findByRole('menuitem', { name: /open past session/i });
      expect(screen.queryByRole('menuitem', { name: /initialize as git repo/i })).toBeNull();
    });

    it('clicking Initialize triggers worktree:initRepo and broadcast repopulates listing', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot(null);
      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/notes', name: 'notes', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/notes"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      const btn = await screen.findByRole('button', { name: /initialize as git repo/i });

      // Side-effect check: send event count should increase
      const claude = summoner.claude();
      const beforeInit = claude.receivedEvents('worktree:added').length;

      await userEvent.setup({ pointerEventsCheck: 0 }).click(btn);

      await waitFor(() => {
        expect(claude.receivedEvents('worktree:added').length).toBeGreaterThan(beforeInit);
      });
    });
  });

  describe('WorktreeRow click sets sidebar selection (does not open chat)', () => {
    it('clicking wt-row sets selectedWorktreeCwd; pendingOpenWorktree stays null', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot('/repo');
      summoner.git()!.addWorktree({
        name: 'feat-x',
        path: '/repo/.claude/worktrees/feat-x',
        branch: 'worktree-feat-x',
      });

      function Probe() {
        const { pendingOpenWorktree, selectedWorktreeCwd } = useNavigationState();
        return (
          <>
            <span role="status" aria-label="pending">
              {JSON.stringify(pendingOpenWorktree)}
            </span>
            <span role="status" aria-label="selected">
              {JSON.stringify(selectedWorktreeCwd)}
            </span>
          </>
        );
      }

      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/repo', name: 'repo', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/repo"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
          <Probe />
        </Wrapper>,
      );

      const wtBtn = await screen.findByRole('button', { name: /open worktree worktree-feat-x/i });
      await userEvent.setup({ pointerEventsCheck: 0 }).click(wtBtn);

      await waitFor(() => {
        const sel = JSON.parse(
          screen.getByRole('status', { name: 'selected' }).textContent ?? '{}',
        );
        expect(sel).toEqual({ '/repo': '/repo/.claude/worktrees/feat-x' });
      });
      // Pure selection — no chat-open intent fired.
      expect(
        JSON.parse(screen.getByRole('status', { name: 'pending' }).textContent ?? 'null'),
      ).toBeNull();
    });
  });

  describe('+ New worktree button (Phase 9)', () => {
    it('git project expanded: shows "+ New worktree…" button', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot('/repo');
      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/repo', name: 'repo', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/repo"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      expect(await screen.findByRole('button', { name: /new worktree/i })).toBeInTheDocument();
    });

    it('non-git project: no "+ New worktree" button (needs git first)', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot(null);
      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/notes', name: 'notes', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/notes"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      await screen.findByRole('button', { name: /initialize as git repo/i });
      expect(screen.queryByRole('button', { name: /new worktree/i })).toBeNull();
    });

    it('click "+ New worktree" opens CreateWorktreeDialog', async () => {
      const { Wrapper, summoner } = makeWrapper();
      summoner.git()!.setProjectRoot('/repo');
      render(
        <Wrapper>
          <ProjectTree
            projects={[{ cwd: '/repo', name: 'repo', pinned: false, lastOpenedAt: '2025-01-01' }]}
            activeProjectCwd="/repo"
            onSelectProject={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      const btn = await screen.findByRole('button', { name: /new worktree/i });
      await userEvent.setup({ pointerEventsCheck: 0 }).click(btn);
      // CreateWorktreeDialog renders an input for the new worktree name
      expect(await screen.findByRole('textbox')).toBeInTheDocument();
    });
  });

  it('"Add Project" button is in the section header (always visible, not at bottom)', () => {
    const { Wrapper } = makeWrapper();
    render(
      <Wrapper>
        <ProjectTree
          projects={[]}
          activeProjectCwd={null}
          onSelectProject={() => {}}
          onAdd={() => {}}
        />
      </Wrapper>,
    );
    const header = screen.getByRole('heading', { name: /projects/i });
    const btn = within(header).getByRole('button', { name: /add project/i });
    expect(btn).toBeInTheDocument();
  });
});
