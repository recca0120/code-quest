import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSummoner, type FakeSummoner } from '@/test/fake-summoner';
import { AppConfigProvider } from '../AppInitContext.tsx';
import {
  type Project,
  ProjectProvider,
  useProjectActions,
  useProjectState,
} from '../ProjectContext.tsx';
import { SessionProvider } from '../SessionContext.tsx';
import { SocketProvider } from '../SocketContext.tsx';

function makeWrapper(summoner: FakeSummoner) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SocketProvider socket={summoner.socket}>
        <AppConfigProvider>
          <SessionProvider>
            <ProjectProvider>{children}</ProjectProvider>
          </SessionProvider>
        </AppConfigProvider>
      </SocketProvider>
    );
  };
}

function setupSummoner(paths: { dirs?: Array<[string, string[]]>; files?: string[] } = {}) {
  const summoner = createFakeSummoner();
  // Make every dir parent an allowed root so projects:add path validation passes.
  // Tests don't care about the root boundary; they care about the test fixture
  // paths being accepted.
  const roots = (paths.dirs ?? []).map(([p]) => p);
  if (roots.length > 0) summoner.filesystem().setRoots(roots);
  for (const [parent, children] of paths.dirs ?? []) {
    summoner.filesystem().addDirectory(parent, children);
  }
  for (const path of paths.files ?? []) {
    summoner.filesystem().addFile(path, '');
  }
  return summoner;
}

describe('ProjectContext (server-backed)', () => {
  it('starts with no projects after initial list response', async () => {
    const summoner = setupSummoner();
    const { result } = renderHook(
      () => ({ state: useProjectState(), actions: useProjectActions() }),
      { wrapper: makeWrapper(summoner) },
    );
    await waitFor(() => expect(result.current.state.projects).toEqual([]));
    expect(result.current.state.activeProjectCwd).toBeNull();
  });

  it('addProject adds a project and sets it as active', async () => {
    const summoner = setupSummoner({ dirs: [['/path/to', ['code-quest']]] });
    const { result } = renderHook(
      () => ({ state: useProjectState(), actions: useProjectActions() }),
      { wrapper: makeWrapper(summoner) },
    );

    await act(async () => {
      await result.current.actions.addProject('/path/to/code-quest');
    });

    await waitFor(() =>
      expect(result.current.state.projects).toEqual([
        expect.objectContaining({ cwd: '/path/to/code-quest', name: 'code-quest' }),
      ]),
    );
    expect(result.current.state.activeProjectCwd).toBe('/path/to/code-quest');
  });

  it('addProject does not duplicate existing project', async () => {
    const summoner = setupSummoner({
      dirs: [['/path/to', ['code-quest', 'DQ']]],
    });
    const { result } = renderHook(
      () => ({ state: useProjectState(), actions: useProjectActions() }),
      { wrapper: makeWrapper(summoner) },
    );

    await act(async () => {
      await result.current.actions.addProject('/path/to/code-quest');
      await result.current.actions.addProject('/path/to/DQ');
      await result.current.actions.addProject('/path/to/code-quest');
    });

    await waitFor(() => expect(result.current.state.projects).toHaveLength(2));
  });

  it('addProject returns error response for non-existent path', async () => {
    // Path /does is within root scope but the directory doesn't exist in fs
    const summoner = setupSummoner({ dirs: [['/does', []]] });
    const { result } = renderHook(() => useProjectActions(), {
      wrapper: makeWrapper(summoner),
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let res: Project | { error: string; path?: string } | undefined;
    await act(async () => {
      res = await result.current.addProject('/does/not/exist');
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[ProjectContext] projects:add failed:',
      expect.objectContaining({ error: 'path_not_found' }),
    );
    warnSpy.mockRestore();
    expect(res).toEqual(
      expect.objectContaining({ error: 'path_not_found', path: '/does/not/exist' }),
    );
  });

  it('reflects projects:added broadcasts (multi-tab consistency)', async () => {
    const summoner = setupSummoner({ dirs: [['/path', ['shared']]] });
    const { result } = renderHook(() => useProjectState(), {
      wrapper: makeWrapper(summoner),
    });
    await waitFor(() => expect(result.current.projects).toEqual([]));

    // Simulate another tab adding a project — server broadcasts projects:added.
    act(() => {
      summoner.claude().pushServerEvent('projects:added', {
        id: '11111111-1111-4111-8111-111111111111',
        path: '/path/shared',
        name: 'shared',
        pinned: false,
        color: null,
        lastOpenedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    });

    await waitFor(() =>
      expect(result.current.projects).toEqual([
        expect.objectContaining({ cwd: '/path/shared', name: 'shared' }),
      ]),
    );
  });

  it('reflects projects:removed broadcasts', async () => {
    const summoner = setupSummoner({ dirs: [['/path', ['proj']]] });
    const { result } = renderHook(
      () => ({ state: useProjectState(), actions: useProjectActions() }),
      { wrapper: makeWrapper(summoner) },
    );

    await act(async () => {
      await result.current.actions.addProject('/path/proj');
    });
    await waitFor(() => expect(result.current.state.projects).toHaveLength(1));

    act(() => {
      summoner.claude().pushServerEvent('projects:removed', {
        id: '00000000-0000-4000-8000-000000000000',
        path: '/path/proj',
      });
    });

    await waitFor(() => expect(result.current.state.projects).toEqual([]));
  });

  it('setActiveProject switches active project', async () => {
    const summoner = setupSummoner({
      dirs: [['/path/to', ['code-quest', 'DQ']]],
    });
    const { result } = renderHook(
      () => ({ state: useProjectState(), actions: useProjectActions() }),
      { wrapper: makeWrapper(summoner) },
    );

    await act(async () => {
      await result.current.actions.addProject('/path/to/code-quest');
      await result.current.actions.addProject('/path/to/DQ');
    });

    act(() => {
      result.current.actions.setActiveProject('/path/to/DQ');
    });

    expect(result.current.state.activeProjectCwd).toBe('/path/to/DQ');
  });

  describe('pinProject / renameProject / removeProject', () => {
    it('pinProject(true) updates state to pinned', async () => {
      const summoner = setupSummoner({ dirs: [['/p', ['a']]] });
      const { result } = renderHook(
        () => ({ state: useProjectState(), actions: useProjectActions() }),
        { wrapper: makeWrapper(summoner) },
      );
      await act(async () => {
        await result.current.actions.addProject('/p/a');
      });
      await waitFor(() => expect(result.current.state.projects).toHaveLength(1));
      expect(result.current.state.projects[0]!.pinned).toBe(false);

      await act(async () => {
        await result.current.actions.pinProject('/p/a', true);
      });
      await waitFor(() => expect(result.current.state.projects[0]!.pinned).toBe(true));
    });

    it('pinProject(false) toggles back to unpinned', async () => {
      const summoner = setupSummoner({ dirs: [['/p', ['a']]] });
      const { result } = renderHook(
        () => ({ state: useProjectState(), actions: useProjectActions() }),
        { wrapper: makeWrapper(summoner) },
      );
      await act(async () => {
        await result.current.actions.addProject('/p/a');
        await result.current.actions.pinProject('/p/a', true);
      });
      await waitFor(() => expect(result.current.state.projects[0]!.pinned).toBe(true));

      await act(async () => {
        await result.current.actions.pinProject('/p/a', false);
      });
      await waitFor(() => expect(result.current.state.projects[0]!.pinned).toBe(false));
    });

    it('renameProject updates name in state', async () => {
      const summoner = setupSummoner({ dirs: [['/p', ['a']]] });
      const { result } = renderHook(
        () => ({ state: useProjectState(), actions: useProjectActions() }),
        { wrapper: makeWrapper(summoner) },
      );
      await act(async () => {
        await result.current.actions.addProject('/p/a');
      });

      await act(async () => {
        await result.current.actions.renameProject('/p/a', 'Renamed');
      });
      await waitFor(() => expect(result.current.state.projects[0]!.name).toBe('Renamed'));
    });

    it('removeProject removes from state when no active sessions', async () => {
      const summoner = setupSummoner({ dirs: [['/p', ['a', 'b']]] });
      const { result } = renderHook(
        () => ({ state: useProjectState(), actions: useProjectActions() }),
        { wrapper: makeWrapper(summoner) },
      );
      await act(async () => {
        await result.current.actions.addProject('/p/a');
        await result.current.actions.addProject('/p/b');
      });
      await waitFor(() => expect(result.current.state.projects).toHaveLength(2));

      await act(async () => {
        await result.current.actions.removeProject('/p/a');
      });
      await waitFor(() => expect(result.current.state.projects).toHaveLength(1));
      expect(result.current.state.projects[0]!.cwd).toBe('/p/b');
    });

    it('pinProject returns project_not_found for unknown cwd (client-side check)', async () => {
      const summoner = setupSummoner();
      const { result } = renderHook(() => useProjectActions(), {
        wrapper: makeWrapper(summoner),
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      let res:
        | { cwd: string; name: string; pinned: boolean; lastOpenedAt: string }
        | { error: string }
        | undefined;
      await act(async () => {
        res = await result.current.pinProject('/unknown', true);
      });

      expect(warnSpy).toHaveBeenCalledWith(
        '[ProjectContext] pinProject/renameProject failed:',
        expect.objectContaining({ error: 'project_not_found' }),
      );
      warnSpy.mockRestore();
      expect(res).toEqual({ error: 'project_not_found' });
    });

    it('removeProject switches active project to next when active is removed', async () => {
      const summoner = setupSummoner({ dirs: [['/p', ['a', 'b']]] });
      const { result } = renderHook(
        () => ({ state: useProjectState(), actions: useProjectActions() }),
        { wrapper: makeWrapper(summoner) },
      );
      await act(async () => {
        await result.current.actions.addProject('/p/a');
        await result.current.actions.addProject('/p/b');
      });
      // /p/b is the most recently added → active
      await waitFor(() => expect(result.current.state.activeProjectCwd).toBe('/p/b'));

      await act(async () => {
        await result.current.actions.removeProject('/p/b');
      });
      await waitFor(() => expect(result.current.state.activeProjectCwd).toBe('/p/a'));
    });
  });
});
