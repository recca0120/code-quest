import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorktreeDropdownMenu } from '../WorktreeContextMenu.tsx';

const TRIGGER = <button type="button">⋯</button>;

async function open() {
  await userEvent.setup({ pointerEventsCheck: 0 }).click(screen.getByRole('button', { name: '⋯' }));
}

describe('WorktreeContextMenu (Dropdown variant)', () => {
  it('renders full menu: Open here / Open in new chat / Copy path / Rename / Archive / Delete', async () => {
    render(
      <WorktreeDropdownMenu
        trigger={TRIGGER}
        onOpenHere={() => {}}
        onOpenInNewChat={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onArchive={() => {}}
        onDelete={() => {}}
      />,
    );
    await open();
    expect(await screen.findByRole('menuitem', { name: /open here/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /open in new chat/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /copy path/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /archive/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
  });

  it('Open here triggers onOpenHere', async () => {
    const onOpenHere = vi.fn();
    render(
      <WorktreeDropdownMenu
        trigger={TRIGGER}
        onOpenHere={onOpenHere}
        onOpenInNewChat={() => {}}
        onCopyPath={() => {}}
        onDelete={() => {}}
      />,
    );
    await open();
    await userEvent
      .setup({ pointerEventsCheck: 0 })
      .click(await screen.findByRole('menuitem', { name: /open here/i }));
    expect(onOpenHere).toHaveBeenCalled();
  });

  it('Open in new chat triggers onOpenInNewChat', async () => {
    const onOpenInNewChat = vi.fn();
    render(
      <WorktreeDropdownMenu
        trigger={TRIGGER}
        onOpenInNewChat={onOpenInNewChat}
        onCopyPath={() => {}}
        onDelete={() => {}}
      />,
    );
    await open();
    await userEvent
      .setup({ pointerEventsCheck: 0 })
      .click(await screen.findByRole('menuitem', { name: /open in new chat/i }));
    expect(onOpenInNewChat).toHaveBeenCalled();
  });

  it('Copy path triggers onCopyPath', async () => {
    const onCopyPath = vi.fn();
    render(
      <WorktreeDropdownMenu
        trigger={TRIGGER}
        onOpenInNewChat={() => {}}
        onCopyPath={onCopyPath}
        onDelete={() => {}}
      />,
    );
    await open();
    await userEvent
      .setup({ pointerEventsCheck: 0 })
      .click(await screen.findByRole('menuitem', { name: /copy path/i }));
    expect(onCopyPath).toHaveBeenCalled();
  });

  it('Delete item has danger styling', async () => {
    render(
      <WorktreeDropdownMenu
        trigger={TRIGGER}
        onOpenInNewChat={() => {}}
        onCopyPath={() => {}}
        onDelete={() => {}}
      />,
    );
    await open();
    const deleteItem = await screen.findByRole('menuitem', { name: /delete/i });
    expect(deleteItem.className).toContain('bg-danger/10');
  });

  it('Delete triggers onDelete', async () => {
    const onDelete = vi.fn();
    render(
      <WorktreeDropdownMenu
        trigger={TRIGGER}
        onOpenInNewChat={() => {}}
        onCopyPath={() => {}}
        onDelete={onDelete}
      />,
    );
    await open();
    await userEvent
      .setup({ pointerEventsCheck: 0 })
      .click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});
