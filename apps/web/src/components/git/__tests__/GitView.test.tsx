import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { GitView } from '../GitView.tsx';

const SAMPLE_DIFF = ['diff --git a/foo.ts b/foo.ts', '@@ -1,2 +1,2 @@', '-old', '+new'].join('\n');

function setup() {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/repo']);
  summoner.filesystem().addDirectory('/repo', []);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SocketProvider socket={summoner.socket}>
        <GitProvider>
          <FsProvider>
            <OpenspecProvider>
              {children}
              <Toaster />
            </OpenspecProvider>
          </FsProvider>
        </GitProvider>
      </SocketProvider>
    );
  }
  return { summoner, Wrapper };
}

describe('GitView', () => {
  it('shows a spinner + Loading… text before git status resolves', () => {
    const { Wrapper } = setup();
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'spinner' })).toBeInTheDocument();
  });

  it('renders status footer with branch and change count when data loaded', async () => {
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    summoner.git()!.setClean(false);
    summoner.git()!.setChangedFiles([
      { status: 'M', file: 'a.ts' },
      { status: 'A', file: 'b.ts' },
    ]);
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    const footer = await screen.findByRole('status', { name: 'pane-status-footer' });
    expect(footer.textContent).toContain('main');
    expect(footer.textContent).toContain('2');
  });

  it('does not render status footer while git status is loading', () => {
    const { Wrapper } = setup();
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    expect(screen.queryByRole('status', { name: 'pane-status-footer' })).toBeNull();
  });

  it('switching cwd shows loading indicator before new data resolves', async () => {
    const { summoner, Wrapper } = setup();
    summoner.filesystem().setRoots(['/projA', '/projB']);
    summoner.filesystem().addDirectory('/projA', []);
    summoner.filesystem().addDirectory('/projB', []);
    summoner.git()!.setBranchForCwd('/projA', 'main-A');
    summoner.git()!.setBranchForCwd('/projB', 'main-B');

    const { rerender } = render(<GitView cwd="/projA" />, { wrapper: Wrapper });
    await screen.findAllByText('main-A').then((els) => els[0]);

    rerender(<GitView cwd="/projB" />);
    // Synchronous read after rerender — before await fires for new data.
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('switching cwd refetches status for the new project', async () => {
    const { summoner, Wrapper } = setup();
    summoner.filesystem().setRoots(['/projA', '/projB']);
    summoner.filesystem().addDirectory('/projA', []);
    summoner.filesystem().addDirectory('/projB', []);
    summoner.git()!.setBranchForCwd('/projA', 'main-A');
    summoner.git()!.setBranchForCwd('/projB', 'main-B');

    const { rerender } = render(<GitView cwd="/projA" />, { wrapper: Wrapper });
    expect(await screen.findAllByText('main-A').then((els) => els[0])).toBeInTheDocument();

    rerender(<GitView cwd="/projB" />);
    expect(await screen.findAllByText('main-B').then((els) => els[0])).toBeInTheDocument();
    expect(screen.queryByText('main-A')).toBeNull();
  });

  it('renders not-a-repo state when status returns notARepo', async () => {
    const { summoner, Wrapper } = setup();
    const { NotARepoError } = await import('@code-quest/git');
    summoner.git()!.setStatusError(new NotARepoError('/repo'));
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    expect(await screen.findByText(/not a git repository/i)).toBeInTheDocument();
    // Hint includes the git init command in a code pill.
    const codeEl = screen.getByText('git init');
    expect(codeEl.tagName).toBe('CODE');
  });

  it('renders branch + clean state', async () => {
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    summoner.git()!.setClean(true);
    summoner.git()!.setChangedFiles([]);
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    expect(await screen.findAllByText(/main/).then((els) => els[0])).toBeInTheDocument();
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });

  it('renders Changes header with count when files are changed', async () => {
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    summoner.git()!.setClean(false);
    summoner.git()!.setChangedFiles([
      { status: 'M', file: 'a.ts' },
      { status: 'M', file: 'b.ts' },
      { status: '??', file: 'c.ts' },
    ]);
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    expect(await screen.findByText(/Changes \(3\)/)).toBeInTheDocument();
  });

  it('renders changed files with status mark', async () => {
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('feat/x');
    summoner.git()!.setClean(false);
    summoner.git()!.setChangedFiles([
      { status: 'M', file: 'src/foo.ts' },
      { status: '??', file: 'src/new.ts' },
    ]);
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    expect(await screen.findByText('src/foo.ts')).toBeInTheDocument();
    expect(screen.getByText('src/new.ts')).toBeInTheDocument();
  });

  it('commit button label includes the changed-files count after expanding composer', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    summoner.git()!.setClean(false);
    summoner.git()!.setChangedFiles([
      { status: 'M', file: 'a.ts' },
      { status: '??', file: 'b.ts' },
    ]);
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    await screen.findAllByText(/main/).then((els) => els[0]);
    await user.click(screen.getByRole('button', { name: /commit message/i }));
    expect(screen.getByRole('button', { name: 'Commit 2' })).toBeInTheDocument();
  });

  describe('discard from DiffDrawer', () => {
    it('modified file: two-click Discard calls git.discardFile with the file path', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setClean(false);
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'src/foo.ts' }]);
      summoner.git()!.setDiff(SAMPLE_DIFF);
      render(<GitView cwd="/repo" />, { wrapper: Wrapper });

      await user.click(await screen.findByText('src/foo.ts'));
      await screen.findByRole('dialog');

      const discard = screen.getByRole('button', { name: /discard/i });
      // First click swaps to confirm state, no RPC yet.
      await user.click(discard);
      expect(summoner.git()!.discardedFiles).toEqual([]);

      // Second click confirms.
      await user.click(screen.getByRole('button', { name: /confirm/i }));
      expect(summoner.git()!.discardedFiles).toEqual(['src/foo.ts']);
    });

    it('untracked file (??): Discard button is disabled', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setClean(false);
      summoner.git()!.setChangedFiles([{ status: '??', file: 'src/new.ts' }]);
      summoner.git()!.setDiff('');
      render(<GitView cwd="/repo" />, { wrapper: Wrapper });

      await user.click(await screen.findByText('src/new.ts'));
      await screen.findByRole('dialog');

      expect(screen.getByRole('button', { name: /discard/i })).toBeDisabled();
    });
  });

  describe('per-file discard in file list', () => {
    it('shows discard button on hover for a modified file', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setClean(false);
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'src/foo.ts' }]);
      render(<GitView cwd="/repo" />, { wrapper: Wrapper });
      await screen.findByText('src/foo.ts');
      await user.hover(screen.getByText('src/foo.ts'));
      expect(screen.getByRole('button', { name: /discard src\/foo\.ts/i })).toBeInTheDocument();
    });

    it('does not show discard button for untracked (??) files', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setClean(false);
      summoner.git()!.setChangedFiles([{ status: '??', file: 'src/new.ts' }]);
      render(<GitView cwd="/repo" />, { wrapper: Wrapper });
      await screen.findByText('src/new.ts');
      await user.hover(screen.getByText('src/new.ts'));
      expect(
        screen.queryByRole('button', { name: /discard src\/new\.ts/i }),
      ).not.toBeInTheDocument();
    });

    it('per-file discard: single click calls discardFile immediately (no confirm)', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setClean(false);
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'src/foo.ts' }]);
      render(<GitView cwd="/repo" />, { wrapper: Wrapper });
      await screen.findByText('src/foo.ts');
      await user.hover(screen.getByText('src/foo.ts'));
      await user.click(screen.getByRole('button', { name: /discard src\/foo\.ts/i }));
      expect(summoner.git()!.discardedFiles).toEqual(['src/foo.ts']);
    });
  });

  it('clicking a changed file opens DiffDrawer with file path', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    summoner.git()!.setClean(false);
    summoner.git()!.setChangedFiles([{ status: 'M', file: 'foo.ts' }]);
    summoner.git()!.setDiff(SAMPLE_DIFF);
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });

    await user.click(await screen.findByText('foo.ts'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/foo\.ts/);
    expect(screen.getByRole('button', { name: /copy path/i })).toBeInTheDocument();
  });

  it('renders Changes and Actions section headings', async () => {
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    summoner.git()!.setClean(false);
    summoner.git()!.setChangedFiles([{ status: 'M', file: 'a.ts' }]);
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    await screen.findByText(/1 change/);
    expect(screen.queryByRole('button', { name: /switch branch/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Changes/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument();
  });

  it('no Refresh button — files:dirty broadcast handles auto-refresh', async () => {
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    await screen.findAllByText(/main/).then((els) => els[0]);
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull();
  });

  it('clicking Fetch triggers git.fetch RPC', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    const fetchSpy = vi.spyOn(summoner.git()!, 'fetch');
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    await screen.findAllByText(/main/).then((els) => els[0]);

    await user.click(screen.getByRole('button', { name: 'Fetch' }));
    expect(fetchSpy).toHaveBeenCalledWith('/repo');
  });

  it('clicking Pull on non-FF shows a resolve-manually toast', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    summoner.git()!.setPullError('non-ff');
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    await screen.findAllByText(/main/).then((els) => els[0]);

    await user.click(screen.getByRole('button', { name: 'Pull' }));
    // Toast text should mention non-FF / manually; use findByText with
    // a looser match since Sonner renders into a portal.
    expect(await screen.findByText(/non-ff|resolve manually|fast-forward/i)).toBeInTheDocument();
  });

  it('Fetch, Pull, Push are all enabled (no disabled placeholders)', async () => {
    const { summoner, Wrapper } = setup();
    summoner.git()!.setBranch('main');
    render(<GitView cwd="/repo" />, { wrapper: Wrapper });
    await screen.findAllByText(/main/).then((els) => els[0]);
    for (const label of ['Fetch', 'Pull', 'Push']) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn).not.toHaveAttribute('aria-disabled', 'true');
    }
  });
});
