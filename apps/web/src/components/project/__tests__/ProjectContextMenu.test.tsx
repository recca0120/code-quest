import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppInitStateContext } from '@/contexts/AppInitContext';
import { ProjectDropdownMenu } from '../ProjectContextMenu.tsx';

/** Provide a minimal AppInitState with worktree capability enabled. */
function WithWorktreeCapability({ children }: { children: ReactNode }) {
  return (
    <AppInitStateContext.Provider
      value={{
        initOptions: {},
        capabilities: { worktree: true },
      }}
    >
      {children}
    </AppInitStateContext.Provider>
  );
}

const TRIGGER = <button type="button">⋯</button>;

async function open() {
  await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByRole('button', { name: '⋯' }));
}

describe('ProjectContextMenu', () => {
  it('renders the "open past session…" item; clicking calls onSelectResume', async () => {
    const onSelectResume = vi.fn();
    render(<ProjectDropdownMenu trigger={TRIGGER} onSelectResume={onSelectResume} />);
    await open();
    const item = await screen.findByRole('menuitem', { name: /open past session/i });
    await userEvent.setup({ pointerEventsCheck: 0 }).click(item);
    expect(onSelectResume).toHaveBeenCalledTimes(1);
  });

  describe('Rename / Remove items', () => {
    it('hides Rename when onSelectRename is not provided', async () => {
      render(<ProjectDropdownMenu trigger={TRIGGER} onSelectResume={() => {}} />);
      await open();
      await screen.findByRole('menuitem', { name: /open past session/i });
      expect(screen.queryByRole('menuitem', { name: /rename/i })).not.toBeInTheDocument();
    });

    it('shows Rename when handler is provided; clicking fires handler', async () => {
      const onSelectRename = vi.fn();
      render(
        <ProjectDropdownMenu
          trigger={TRIGGER}
          onSelectResume={() => {}}
          onSelectRename={onSelectRename}
        />,
      );
      await open();
      const item = await screen.findByRole('menuitem', { name: /rename/i });
      await userEvent.setup({ pointerEventsCheck: 0 }).click(item);
      expect(onSelectRename).toHaveBeenCalledTimes(1);
    });

    it('shows Remove with danger styling when handler is provided; clicking fires handler', async () => {
      const onSelectRemove = vi.fn();
      render(
        <ProjectDropdownMenu
          trigger={TRIGGER}
          onSelectResume={() => {}}
          onSelectRemove={onSelectRemove}
        />,
      );
      await open();
      const item = await screen.findByRole('menuitem', { name: /remove/i });
      await userEvent.setup({ pointerEventsCheck: 0 }).click(item);
      expect(onSelectRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Create Worktree item', () => {
    it('hides the item when no GitProvider (capabilities default to worktree=false)', async () => {
      render(
        <ProjectDropdownMenu
          trigger={TRIGGER}
          onSelectResume={() => {}}
          onSelectCreateWorktree={() => {}}
        />,
      );
      await open();
      await screen.findByRole('menuitem', { name: /open past session/i });
      expect(screen.queryByRole('menuitem', { name: /Create Worktree/i })).not.toBeInTheDocument();
    });

    it('hides the item when onSelectCreateWorktree is not provided (even if capability is true)', async () => {
      render(
        <WithWorktreeCapability>
          <ProjectDropdownMenu trigger={TRIGGER} onSelectResume={() => {}} />
        </WithWorktreeCapability>,
      );
      await open();
      await screen.findByRole('menuitem', { name: /open past session/i });
      expect(screen.queryByRole('menuitem', { name: /Create Worktree/i })).not.toBeInTheDocument();
    });

    it('shows the item when capability is true AND handler is provided; clicking fires handler', async () => {
      const onSelectCreateWorktree = vi.fn();
      render(
        <WithWorktreeCapability>
          <ProjectDropdownMenu
            trigger={TRIGGER}
            onSelectResume={() => {}}
            onSelectCreateWorktree={onSelectCreateWorktree}
          />
        </WithWorktreeCapability>,
      );
      await open();
      const item = await screen.findByRole('menuitem', { name: /Create Worktree/i });
      await userEvent.setup({ pointerEventsCheck: 0 }).click(item);
      expect(onSelectCreateWorktree).toHaveBeenCalledTimes(1);
    });
  });
});
