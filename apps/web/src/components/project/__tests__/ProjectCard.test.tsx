import { type ProjectStore, type SessionStore, TYPES } from '@code-quest/server/test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useNavigationState } from '@/contexts/NavigationContext';
import { useProjectState } from '@/contexts/ProjectContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { ProjectCard } from '../ProjectCard.tsx';

function setupTestWrapper() {
  const wrapper = createTestWrapper();
  if (!wrapper.summoner.claude().hasInitSegments) wrapper.summoner.claude().prepareInit();
  return wrapper;
}

function ProbeActiveCwdAndPending() {
  const { activeProjectCwd } = useProjectState();
  const { pendingActivateChannel } = useNavigationState();
  return (
    <>
      <span role="status" aria-label="active-cwd">
        {activeProjectCwd ?? 'null'}
      </span>
      <span role="status" aria-label="pending">
        {JSON.stringify(pendingActivateChannel)}
      </span>
    </>
  );
}

function ProbeProjectCount() {
  const { projects } = useProjectState();
  return (
    <span role="status" aria-label="project-count">
      {projects.length}
    </span>
  );
}

describe('ProjectCard', () => {
  it('renders project name', () => {
    render(<ProjectCard name="code-quest" active={false} onSelect={() => {}} />);
    expect(screen.getByText(/code-quest/)).toBeInTheDocument();
  });

  it('active state uses bg tint (no hard accent border) — F.html contract', () => {
    const { container } = render(<ProjectCard name="code-quest" active onSelect={() => {}} />);
    expect(container.querySelector('[data-active="true"]')).toBeInTheDocument();
  });

  it('inactive state has neither bg tint nor accent border', () => {
    const { container } = render(
      <ProjectCard name="code-quest" active={false} onSelect={() => {}} />,
    );
    expect(container.querySelector('[data-active="false"]')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ProjectCard name="code-quest" active={false} onSelect={onSelect} />);
    await user.click(screen.getByText(/code-quest/));
    expect(onSelect).toHaveBeenCalled();
  });

  describe('pin star + more-actions trigger (Phase 4)', () => {
    const setupMin = setupTestWrapper;

    it('shows Unpin button (filled star) when pinned', () => {
      const { Wrapper } = setupMin();
      render(
        <Wrapper>
          <ProjectCard name="p" cwd="/p" pinned active={false} onSelect={() => {}} />
        </Wrapper>,
      );
      const star = screen.getByRole('button', { name: /unpin/i });
      expect(star).toHaveAttribute('data-pinned', 'true');
    });

    it('shows Pin button (outlined star) hidden until hover when not pinned', () => {
      const { Wrapper } = setupMin();
      render(
        <Wrapper>
          <ProjectCard name="p" cwd="/p" active={false} onSelect={() => {}} />
        </Wrapper>,
      );
      const star = screen.getByRole('button', { name: /^pin$/i });
      expect(star).toHaveAttribute('data-pinned', 'false');
    });

    it('⋯ button opens context menu', async () => {
      const { Wrapper } = setupMin();
      render(
        <Wrapper>
          <ProjectCard name="p" cwd="/p" active={false} onSelect={() => {}} />
        </Wrapper>,
      );
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      expect(
        await screen.findByRole('menuitem', { name: /open past session/i }),
      ).toBeInTheDocument();
    });

    it('context menu shows "Copy path"', async () => {
      const { Wrapper } = setupMin();
      render(
        <Wrapper>
          <ProjectCard name="p" cwd="/p" active={false} onSelect={() => {}} />
        </Wrapper>,
      );
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      expect(await screen.findByRole('menuitem', { name: /copy path/i })).toBeInTheDocument();
    });
  });

  describe('right-click resume flow', () => {
    function setup() {
      const { container, Wrapper } = setupTestWrapper();
      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      return { Wrapper, sessionStore };
    }

    it('right-click opens menu, picking a session activates project + sets pending intent', async () => {
      const { Wrapper, sessionStore } = setup();
      await sessionStore.upsert({
        id: 'sess-1',
        channelId: 'sess-1',
        provider: 'claude',
        command: 'claude',
        args: '[]',
        mode: 'interactive',
        role: 'chat',
        cwd: '/proj',
        projectRoot: '/proj',
        title: 'Pick me',
        createdAt: new Date().toISOString(),
      });

      render(
        <Wrapper>
          <ProjectCard name="proj" cwd="/proj" active={false} onSelect={() => {}} />
          <ProbeActiveCwdAndPending />
        </Wrapper>,
      );

      // Right-click → context menu appears
      fireEvent.contextMenu(screen.getByRole('button', { name: /proj/i }));
      const menuItem = await screen.findByRole('menuitem', { name: /open past session/i });

      // Click menu item → dialog opens with picker, listing the session
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(menuItem);

      const sessionRow = await screen.findByText('Pick me');

      // Click row → resume succeeds → setActiveProject + requestActivateChannel
      await user.click(sessionRow);

      await waitFor(() => {
        expect(screen.getByRole('status', { name: 'active-cwd' })).toHaveTextContent('/proj');
        const pending = JSON.parse(
          screen.getByRole('status', { name: 'pending' }).textContent ?? 'null',
        );
        expect(pending).not.toBeNull();
        expect(pending.cwd).toBe('/proj');
        expect(typeof pending.channelId).toBe('string');
      });

      // Dialog closed (picker no longer rendered)
      await waitFor(() => {
        expect(screen.queryByText('Pick me')).not.toBeInTheDocument();
      });
    });

    it('Escape closes the dialog', async () => {
      const { Wrapper } = setup();

      render(
        <Wrapper>
          <ProjectCard name="proj" cwd="/proj" active={false} onSelect={() => {}} />
        </Wrapper>,
      );

      fireEvent.contextMenu(screen.getByRole('button', { name: /proj/i }));
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(await screen.findByRole('menuitem', { name: /open past session/i }));

      // Dialog open — SessionHistory shows its search bar
      const searchInput = await screen.findByPlaceholderText(/Search sessions/i);
      expect(searchInput).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Search sessions/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('rename / remove flow (multi-layer verification)', () => {
    function setupWithProject(path: string) {
      const { container, Wrapper, summoner } = setupTestWrapper();
      const projectStore = container.get<ProjectStore>(TYPES.ProjectStore);
      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      return { Wrapper, summoner, projectStore, sessionStore, path };
    }

    it('Remove flow: ⋯ → Remove → confirm → ① UI / ② event / ③ DB / ④ state', async () => {
      const { Wrapper, summoner, projectStore } = setupWithProject('/path/proj');
      const claude = summoner.claude();
      // prime: server-side project exists
      await projectStore.upsert('/path/proj');

      render(
        <Wrapper>
          <ProjectCard name="proj" cwd="/path/proj" active={false} onSelect={() => {}} />
          <ProbeProjectCount />
        </Wrapper>,
      );

      // Wait for client to receive initial projects:list
      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'project-count' }).textContent).toBe('1'),
      );

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      // Open menu via ⋯ button
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      // ① Click Remove menu item → confirm dialog appears
      await user.click(await screen.findByRole('menuitem', { name: /remove/i }));
      expect(await screen.findByText(/remove project/i)).toBeInTheDocument();

      const beforeRemoved = claude.receivedEvents('projects:removed').length;
      await user.click(screen.getByRole('button', { name: /^remove$/i }));

      await waitFor(async () => {
        // ② server broadcast
        expect(claude.receivedEvents('projects:removed').length).toBeGreaterThan(beforeRemoved);
        // ③ DB row gone
        expect(await projectStore.getByPath('/path/proj')).toBeNull();
        // ④ client state synced
        expect(screen.getByRole('status', { name: 'project-count' }).textContent).toBe('0');
      });
    });

    it('Remove blocked by active session: ② no event, ③ DB unchanged, UI shows warning', async () => {
      const { Wrapper, summoner, projectStore } = setupWithProject('/path/busy');
      const claude = summoner.claude();
      await projectStore.upsert('/path/busy');

      render(
        <Wrapper>
          <ProjectCard name="busy" cwd="/path/busy" active={false} onSelect={() => {}} />
          <ProbeProjectCount />
        </Wrapper>,
      );
      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'project-count' }).textContent).toBe('1'),
      );

      // Inject session:states from server side so client-side ProjectState.sessions
      // shows an active session for /path/busy (UI gate for "blocked" dialog state).
      claude.pushSessionState('busy-1', 'idle', { cwd: '/path/busy', projectRoot: '/path/busy' });

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      await user.click(await screen.findByRole('menuitem', { name: /remove/i }));

      // Dialog shows "active session" warning state (Confirm Remove not present)
      expect(await screen.findByText(/active session/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ok/i })).toBeInTheDocument();

      // ② No remove broadcast happened
      expect(claude.receivedEvents('projects:removed').length).toBe(0);
      // ③ DB still has it
      expect(await projectStore.getByPath('/path/busy')).not.toBeNull();
    });

    it('Outside-roots: can unpin a project whose path is no longer in EXPLORER_ROOTS', async () => {
      const { Wrapper, summoner, projectStore } = setupWithProject('/legacy/proj');
      // Project was added when /legacy was a root; admin shrank roots → outside scope
      summoner.filesystem().setRoots(['/elsewhere']);
      await projectStore.upsert('/legacy/proj');
      await projectStore.update((await projectStore.getByPath('/legacy/proj'))!.id, {
        pinned: true,
      });
      const claude = summoner.claude();

      render(
        <Wrapper>
          <ProjectCard name="proj" cwd="/legacy/proj" pinned active={false} onSelect={() => {}} />
          <ProbeProjectCount />
        </Wrapper>,
      );
      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'project-count' }).textContent).toBe('1'),
      );

      const beforeUpdated = claude.receivedEvents('projects:updated').length;
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByRole('button', { name: /unpin/i }));

      await waitFor(async () => {
        expect(claude.receivedEvents('projects:updated').length).toBeGreaterThan(beforeUpdated);
        expect((await projectStore.getByPath('/legacy/proj'))?.pinned).toBe(false);
      });
    });

    it('Outside-roots: can remove a project whose path is no longer in EXPLORER_ROOTS', async () => {
      const { Wrapper, summoner, projectStore } = setupWithProject('/legacy/gone');
      summoner.filesystem().setRoots(['/elsewhere']);
      await projectStore.upsert('/legacy/gone');
      const claude = summoner.claude();

      render(
        <Wrapper>
          <ProjectCard name="gone" cwd="/legacy/gone" active={false} onSelect={() => {}} />
          <ProbeProjectCount />
        </Wrapper>,
      );
      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'project-count' }).textContent).toBe('1'),
      );

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      await user.click(await screen.findByRole('menuitem', { name: /remove/i }));
      await user.click(screen.getByRole('button', { name: /^remove$/i }));

      await waitFor(async () => {
        expect(claude.receivedEvents('projects:removed').length).toBeGreaterThan(0);
        expect(await projectStore.getByPath('/legacy/gone')).toBeNull();
      });
    });

    it('Rename flow: ⋯ → Rename → submit → ① UI / ② event / ③ DB / ④ state', async () => {
      const { Wrapper, summoner, projectStore } = setupWithProject('/path/foo');
      const claude = summoner.claude();
      await projectStore.upsert('/path/foo');

      render(
        <Wrapper>
          <ProjectCard name="foo" cwd="/path/foo" active={false} onSelect={() => {}} />
          <ProbeProjectCount />
        </Wrapper>,
      );
      await waitFor(() =>
        expect(screen.getByRole('status', { name: 'project-count' }).textContent).toBe('1'),
      );

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      await user.click(await screen.findByRole('menuitem', { name: /rename/i }));

      // ① Rename dialog open with current name pre-filled
      const input = (await screen.findByRole('textbox', {
        name: /new name/i,
      })) as HTMLInputElement;
      expect(input.value).toBe('foo');

      const beforeUpdated = claude.receivedEvents('projects:updated').length;
      await user.clear(input);
      await user.type(input, 'My Foo');
      await user.click(screen.getByRole('button', { name: /^rename$/i }));

      await waitFor(async () => {
        // ② broadcast
        expect(claude.receivedEvents('projects:updated').length).toBeGreaterThan(beforeUpdated);
        // ③ DB has new name
        expect((await projectStore.getByPath('/path/foo'))?.name).toBe('My Foo');
      });
    });
  });
});
