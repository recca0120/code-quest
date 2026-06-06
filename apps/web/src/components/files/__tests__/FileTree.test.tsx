import { createFakeServer, createTestContainer, TYPES } from '@code-quest/server/test';
import type { FakeFileWatcher } from '@code-quest/test-kit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useFsActions } from '@/contexts/FsContext';
import { createFakeSummoner, FakeSummoner } from '@/test/fake-summoner';
import { FsProvidersWrapper } from '@/test/wrap-fs-providers';
import { FileTree } from '../FileTree.tsx';

function setup() {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/projects']);
  summoner.filesystem().addDirectory('/projects', ['app', 'blog']);
  summoner.filesystem().addDirectory('/projects/app', ['src', 'tests']);
  summoner.filesystem().addFile('/projects/app/README.md', '# hi');

  function Wrapper({ children }: { children: ReactNode }) {
    return <FsProvidersWrapper socket={summoner.socket}>{children}</FsProvidersWrapper>;
  }

  return { summoner, Wrapper };
}

describe('FileTree', () => {
  it('renders root directories on mount', async () => {
    const { Wrapper } = setup();
    render(<FileTree />, { wrapper: Wrapper });

    expect(await screen.findByRole('treeitem', { name: 'projects' })).toBeInTheDocument();
  });

  it('expands directory on click to show children', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    render(<FileTree />, { wrapper: Wrapper });

    const projects = await screen.findByRole('treeitem', { name: 'projects' });
    await user.click(projects);

    expect(await screen.findByRole('treeitem', { name: 'app' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'blog' })).toBeInTheDocument();
  });

  it('shows context menu on right-click with Open in New Tab on a file row', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onSelect = vi.fn();
    render(<FileTree onSelect={onSelect} />, { wrapper: Wrapper });

    // Expand projects + app to reveal README.md
    await user.click(await screen.findByRole('treeitem', { name: 'projects' }));
    await user.click(await screen.findByRole('treeitem', { name: 'app' }));
    const readme = await screen.findByRole('treeitem', { name: 'README.md' });
    await user.pointer({ keys: '[MouseRight]', target: readme });

    expect(screen.getByText('Open in New Tab')).toBeInTheDocument();
  });

  it('context menu Open in New Tab fires onSelect', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onSelect = vi.fn();
    render(<FileTree onSelect={onSelect} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('treeitem', { name: 'projects' }));
    await user.click(await screen.findByRole('treeitem', { name: 'app' }));
    const readme = await screen.findByRole('treeitem', { name: 'README.md' });
    await user.pointer({ keys: '[MouseRight]', target: readme });
    await user.click(screen.getByText('Open in New Tab'));

    expect(onSelect).toHaveBeenCalledWith('/projects/app/README.md');
    expect(screen.queryByText('Open in New Tab')).not.toBeInTheDocument();
  });

  it('directory row context menu has CRUD items but no Open in New Tab', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    render(<FileTree />, { wrapper: Wrapper });

    const projects = await screen.findByRole('treeitem', { name: 'projects' });
    await user.pointer({ keys: '[MouseRight]', target: projects });

    expect(screen.queryByText('Open in New Tab')).toBeNull();
    expect(screen.getByText('New file…')).toBeInTheDocument();
    expect(screen.getByText('New folder…')).toBeInTheDocument();
    expect(screen.getByText('Rename…')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders files as leaf treeitems beneath their directory', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    render(<FileTree />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('treeitem', { name: 'projects' }));
    await user.click(await screen.findByRole('treeitem', { name: 'app' }));

    expect(await screen.findByRole('treeitem', { name: 'README.md' })).toBeInTheDocument();
  });

  it('directories appear before files, each group sorted alphabetically', async () => {
    const summoner = createFakeSummoner();
    summoner.filesystem().setRoots(['/projects']);
    summoner.filesystem().addDirectory('/projects', ['z-dir', 'a-dir']);
    summoner.filesystem().addFile('/projects/m-file.ts', '');
    summoner.filesystem().addFile('/projects/a-file.ts', '');
    function Wrapper({ children }: { children: ReactNode }) {
      return <FsProvidersWrapper socket={summoner.socket}>{children}</FsProvidersWrapper>;
    }
    render(<FileTree rootCwd="/projects" />, { wrapper: Wrapper });

    const items = await screen.findAllByRole('treeitem');
    const labels = items.map((i) => i.getAttribute('aria-label') ?? i.textContent ?? '');
    const aDir = labels.findIndex((l) => l.includes('a-dir'));
    const zDir = labels.findIndex((l) => l.includes('z-dir'));
    const aFile = labels.findIndex((l) => l.includes('a-file'));
    const mFile = labels.findIndex((l) => l.includes('m-file'));
    // Both directories come before both files
    expect(Math.max(aDir, zDir)).toBeLessThan(Math.min(aFile, mFile));
    // Directories sorted alphabetically
    expect(aDir).toBeLessThan(zDir);
    // Files sorted alphabetically
    expect(aFile).toBeLessThan(mFile);
  });

  it('fires onActivate with path and event when file is clicked', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onActivate = vi.fn();
    render(<FileTree onActivate={onActivate} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('treeitem', { name: 'projects' }));
    await user.click(await screen.findByRole('treeitem', { name: 'app' }));
    await user.click(await screen.findByRole('treeitem', { name: 'README.md' }));

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0]![0]).toMatchObject({
      path: '/projects/app/README.md',
      kind: 'file',
    });
    expect(onActivate.mock.calls[0]![1]).toMatchObject({ type: 'click' });
  });

  it('renders gitMarks badge next to file names that match the map', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    render(<FileTree gitMarks={new Map([['/projects/app/README.md', 'M']])} />, {
      wrapper: Wrapper,
    });
    await user.click(await screen.findByRole('treeitem', { name: 'projects' }));
    await user.click(await screen.findByRole('treeitem', { name: 'app' }));
    expect(
      await screen.findByRole('status', { name: 'git-mark-/projects/app/README.md' }),
    ).toHaveTextContent('M');
  });

  it('rootCwd: roots at given path; root items are its children, not configured roots', async () => {
    const summoner = createFakeSummoner();
    summoner.filesystem().setRoots(['/projects']);
    summoner.filesystem().addDirectory('/projects', ['app']);
    summoner.filesystem().addDirectory('/projects/app', ['src', 'tests']);
    summoner.filesystem().addFile('/projects/app/README.md', '# hi');
    function Wrapper({ children }: { children: ReactNode }) {
      return <FsProvidersWrapper socket={summoner.socket}>{children}</FsProvidersWrapper>;
    }
    render(<FileTree rootCwd="/projects/app" />, { wrapper: Wrapper });

    expect(await screen.findByRole('treeitem', { name: 'src' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'tests' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'projects' })).toBeNull();
  });

  it('does not fire onActivate when a directory is clicked', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onActivate = vi.fn();
    render(<FileTree onActivate={onActivate} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('treeitem', { name: 'projects' }));

    expect(onActivate).not.toHaveBeenCalled();
  });

  it('fires onSelect when directory is double-clicked', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onSelect = vi.fn();
    render(<FileTree onSelect={onSelect} />, { wrapper: Wrapper });

    const projects = await screen.findByRole('treeitem', { name: 'projects' });
    await user.dblClick(projects);

    expect(onSelect).toHaveBeenCalledWith('/projects');
  });

  describe('fine-grained invalidation on fs:dirty', () => {
    /** Container-aware setup with access to FakeFileWatcher for triggering
     *  realistic dirty events via the server-side broadcaster. */
    function setupWithWatch() {
      const container = createTestContainer();
      const server = createFakeServer(container);
      const summoner = new FakeSummoner(server);
      summoner.filesystem().setRoots(['/projects']);
      summoner.filesystem().addDirectory('/projects', ['app']);
      summoner.filesystem().addDirectory('/projects/app', ['src', 'tests']);
      summoner.filesystem().addFile('/projects/app/README.md', '# hi');
      summoner.filesystem().addFile('/projects/app/src/foo.ts', '');
      const watch = container.get<FakeFileWatcher>(TYPES.FileWatcher);

      // Subscribe via FsActions so fs:watch reaches the server. Empty
      // cb — FileTree renders below and owns its own subscribe with the
      // actual invalidation logic; we just need the watcher kept alive.
      function FsWatchKeeper({ cwd }: { cwd: string }) {
        const { subscribeFsDirty } = useFsActions();
        useEffect(() => subscribeFsDirty(cwd, () => {}), [cwd, subscribeFsDirty]);
        return null;
      }

      function Wrapper({ children }: { children: ReactNode }) {
        return <FsProvidersWrapper socket={summoner.socket}>{children}</FsProvidersWrapper>;
      }

      return { Wrapper, FsWatchKeeper, summoner, watch };
    }

    it('file change updates tree from snapshot without calling browseEntries for root', async () => {
      const { Wrapper, FsWatchKeeper, summoner, watch } = setupWithWatch();
      const browseSpy = vi.spyOn(summoner.filesystem(), 'browseEntries');

      render(
        <Wrapper>
          <FsWatchKeeper cwd="/projects/app" />
          <FileTree rootCwd="/projects/app" />
        </Wrapper>,
      );

      await screen.findByRole('treeitem', { name: 'src' });

      // Add a new file so the snapshot will include it
      summoner.filesystem().addFile('/projects/app/new-file.ts', '');
      browseSpy.mockClear();

      await act(async () => {
        watch.simulate('/projects/app', { type: 'add', path: 'new-file.ts' });
      });

      // New file appears in the tree (snapshot was used)
      await screen.findByRole('treeitem', { name: 'new-file.ts' });

      // browseEntries for root must NOT have been called — snapshot drove the update
      const rootCalls = browseSpy.mock.calls.filter((c) => c[0] === '/projects/app').length;
      expect(rootCalls).toBe(0);
    });

    it('expanded directory STAYS expanded across a dirty event (no full remount)', async () => {
      const user = userEvent.setup();
      const { Wrapper, FsWatchKeeper, watch } = setupWithWatch();

      render(
        <Wrapper>
          <FsWatchKeeper cwd="/projects/app" />
          <FileTree rootCwd="/projects/app" />
        </Wrapper>,
      );

      await user.click(await screen.findByRole('treeitem', { name: 'src' }));
      // Confirm src is expanded by checking its child is visible
      expect(await screen.findByRole('treeitem', { name: 'foo.ts' })).toBeInTheDocument();

      await act(async () => {
        watch.simulate('/projects/app', { type: 'change', path: 'README.md' });
      });

      // After dirty, src must remain expanded — foo.ts still rendered
      await waitFor(() => {
        expect(screen.getByRole('treeitem', { name: 'foo.ts' })).toBeInTheDocument();
      });
    });
  });
});
