import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { FsProvidersWrapper } from '@/test/wrap-fs-providers';
import { FilesView } from '../FilesView.tsx';

function setup() {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/repo']);
  summoner.filesystem().addDirectory('/repo', []);
  summoner.filesystem().addFile('/repo/README.md', '# hi');
  function Wrapper({ children }: { children: ReactNode }) {
    return <FsProvidersWrapper socket={summoner.socket}>{children}</FsProvidersWrapper>;
  }
  return { summoner, Wrapper };
}

describe('FilesView', () => {
  it('renders the file tree rooted at cwd (children, not the cwd itself)', async () => {
    const { Wrapper } = setup();
    render(<FilesView cwd="/repo" onMention={vi.fn()} />, { wrapper: Wrapper });
    expect(await screen.findByRole('treeitem', { name: 'README.md' })).toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'repo' })).toBeNull();
  });

  it('plain click on a file opens preview drawer (tree stays visible)', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    render(<FilesView cwd="/repo" onMention={vi.fn()} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('treeitem', { name: 'README.md' }));

    expect(await screen.findByRole('button', { name: /mention/i })).toBeInTheDocument();
    // tree stays in DOM (aria-hidden by dialog, but not removed)
    expect(screen.getByRole('tree', { hidden: true })).toBeInTheDocument();
  });

  it('closing drawer returns focus to tree without removing it', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    render(<FilesView cwd="/repo" onMention={vi.fn()} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await screen.findByRole('button', { name: /mention/i });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /mention/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tree')).toBeInTheDocument();
  });

  it('shows "Path outside allowed roots" when cwd is outside fsRoots', async () => {
    const summoner = createFakeSummoner();
    summoner.filesystem().setRoots(['/projA']);
    summoner.filesystem().addDirectory('/projA', []);
    function Wrapper({ children }: { children: ReactNode }) {
      return <FsProvidersWrapper socket={summoner.socket}>{children}</FsProvidersWrapper>;
    }
    render(<FilesView cwd="/somewhere/outside" onMention={vi.fn()} />, { wrapper: Wrapper });
    expect(await screen.findByText(/path outside allowed roots/i)).toBeInTheDocument();
  });

  it('shows skeleton rows before the file tree root resolves', () => {
    const { Wrapper } = setup();
    render(<FilesView cwd="/repo" onMention={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('switching cwd swaps the tree to the new project root', async () => {
    const summoner = createFakeSummoner();
    summoner.filesystem().setRoots(['/projA', '/projB']);
    summoner.filesystem().addDirectory('/projA', []);
    summoner.filesystem().addFile('/projA/A-only.md', '');
    summoner.filesystem().addDirectory('/projB', []);
    summoner.filesystem().addFile('/projB/B-only.md', '');
    function Wrapper({ children }: { children: ReactNode }) {
      return <FsProvidersWrapper socket={summoner.socket}>{children}</FsProvidersWrapper>;
    }
    const { rerender } = render(<FilesView cwd="/projA" onMention={vi.fn()} />, {
      wrapper: Wrapper,
    });
    expect(await screen.findByRole('treeitem', { name: 'A-only.md' })).toBeInTheDocument();

    rerender(<FilesView cwd="/projB" onMention={vi.fn()} />);
    expect(await screen.findByRole('treeitem', { name: 'B-only.md' })).toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'A-only.md' })).toBeNull();
  });

  it('Cmd/Meta+click on a file fires onMention without opening drawer', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onMention = vi.fn();
    render(<FilesView cwd="/repo" onMention={onMention} />, { wrapper: Wrapper });

    await user.keyboard('{Meta>}');
    await user.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await user.keyboard('{/Meta}');

    expect(onMention).toHaveBeenCalledWith('/repo/README.md');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows file content in drawer after clicking a file', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    render(<FilesView cwd="/repo" onMention={vi.fn()} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('treeitem', { name: 'README.md' }));

    expect(await screen.findByRole('heading', { name: /hi/i })).toBeInTheDocument();
  });

  it('shows too-large message when server returns tooLarge', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.filesystem().addFile('/repo/huge.txt', 'x'.repeat(2 * 1024 * 1024 + 1));
    render(<FilesView cwd="/repo" onMention={vi.fn()} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole('treeitem', { name: 'huge.txt' }));

    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
  });

  it('resets viewMode to preview when a new file is opened', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.filesystem().addFile('/repo/other.md', '# Other');
    render(<FilesView cwd="/repo" onMention={vi.fn()} />, { wrapper: Wrapper });

    // open README.md and switch to raw
    await user.click(await screen.findByRole('treeitem', { name: 'README.md' }));
    await screen.findByRole('heading', { name: /hi/i });
    await user.click(screen.getByRole('button', { name: /raw/i }));
    expect(screen.queryByRole('heading', { name: /hi/i })).not.toBeInTheDocument();

    // close drawer
    await user.keyboard('{Escape}');

    // open other.md — should be back to preview
    await user.click(await screen.findByRole('treeitem', { name: 'other.md' }));
    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument();
  });
});
