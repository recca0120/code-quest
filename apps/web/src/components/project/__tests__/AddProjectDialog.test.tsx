import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { AddProjectDialog } from '../AddProjectDialog.tsx';

function setup() {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/projects']);
  summoner.filesystem().addDirectory('/projects', ['code-quest', 'DQ']);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SocketProvider socket={summoner.socket}>
        <GitProvider>
          <FsProvider>
            <OpenspecProvider>{children}</OpenspecProvider>
          </FsProvider>
        </GitProvider>
      </SocketProvider>
    );
  }

  return { Wrapper };
}

describe('AddProjectDialog', () => {
  it('shows the directory picker when opened', async () => {
    const { Wrapper } = setup();
    render(<AddProjectDialog open onSelect={() => {}} onClose={() => {}} />, { wrapper: Wrapper });

    expect(screen.getByText('Select Project Directory')).toBeInTheDocument();
    expect(await screen.findByRole('treeitem', { name: 'projects' })).toBeInTheDocument();
  });

  it('Cancel closes dialog', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onClose = vi.fn();
    render(<AddProjectDialog open onSelect={() => {}} onClose={onClose} />, { wrapper: Wrapper });

    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when open is false', () => {
    const { Wrapper } = setup();
    render(<AddProjectDialog open={false} onSelect={() => {}} onClose={() => {}} />, {
      wrapper: Wrapper,
    });
    expect(screen.queryByText('Select Project Directory')).not.toBeInTheDocument();
  });

  it('Escape key closes dialog', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onClose = vi.fn();
    render(<AddProjectDialog open onSelect={() => {}} onClose={onClose} />, { wrapper: Wrapper });

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('has an accessible dialog role with title', () => {
    const { Wrapper } = setup();
    render(<AddProjectDialog open onSelect={() => {}} onClose={() => {}} />, { wrapper: Wrapper });
    expect(screen.getByRole('dialog', { name: /Select Project Directory/i })).toBeInTheDocument();
  });

  it('confirm button is labelled "Add", not "Open"', () => {
    const { Wrapper } = setup();
    render(<AddProjectDialog open onSelect={() => {}} onClose={() => {}} />, { wrapper: Wrapper });
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^open$/i })).toBeNull();
  });

  it('rows in addedProjectCwds render aria-disabled and clicking does not highlight them', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    const onSelect = vi.fn();
    render(
      <AddProjectDialog
        open
        onSelect={onSelect}
        onClose={() => {}}
        addedProjectCwds={new Set(['/projects/code-quest'])}
      />,
      { wrapper: Wrapper },
    );

    // Expand the parent so the disabled child is visible.
    await user.click(await screen.findByRole('treeitem', { name: 'projects' }));
    const disabled = await screen.findByRole('treeitem', { name: 'code-quest' });
    expect(disabled).toHaveAttribute('aria-disabled', 'true');

    // Click the disabled row: highlight must NOT change to its path.
    await user.click(disabled);
    expect(screen.queryByText('/projects/code-quest')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('right-click on a directory row reveals the CRUD context menu', async () => {
    const user = userEvent.setup();
    const { Wrapper } = setup();
    render(<AddProjectDialog open onSelect={() => {}} onClose={() => {}} />, { wrapper: Wrapper });

    const projects = await screen.findByRole('treeitem', { name: 'projects' });
    await user.pointer({ keys: '[MouseRight]', target: projects });

    expect(screen.getByText('New file…')).toBeInTheDocument();
    expect(screen.getByText('New folder…')).toBeInTheDocument();
    expect(screen.getByText('Rename…')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});
