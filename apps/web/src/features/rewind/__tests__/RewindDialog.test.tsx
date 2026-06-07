import type { FakeClaude } from '@code-quest/test-kit';
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { emitAssistantTurn, emitUserEcho } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';
import { rewindOpenSignal } from '../rewind-feature.ts';

afterEach(() => {
  rewindOpenSignal.setOpen(false);
});

type User = ReturnType<typeof userEvent.setup>;

async function sendMessage(claude: FakeClaude, user: User, text: string) {
  const textarea = screen.getByPlaceholderText(/Esc to focus/i);
  await user.click(textarea);
  await user.type(textarea, text);
  await user.keyboard('{Enter}');
  await emitUserEcho(claude, text);
  await emitAssistantTurn(claude, `Reply to: ${text}`);
}

async function openRewindDialog(user: User) {
  const textarea = screen.getByPlaceholderText(/Esc to focus/i);
  await user.click(textarea);
  await user.type(textarea, '/rewind');
  const rewindItem = await screen.findByText('Rewind');
  await user.click(rewindItem);
}

describe('RewindDialog', () => {
  it('opens from Command Menu and shows user messages', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendMessage(claude, user, 'First question');
    await sendMessage(claude, user, 'Second question');

    await openRewindDialog(user);

    const dialog = await screen.findByRole('dialog', { name: /rewind/i });
    expect(dialog).toBeInTheDocument();

    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(2);
    // Most recent first
    expect(items[0]).toHaveTextContent('Second question');
    expect(items[1]).toHaveTextContent('First question');
  });

  it('shows empty state when no messages', async () => {
    const { user, addProject: addProj } = await renderWithWorkspace();
    const project = await addProj();
    await project.launchSession();

    await openRewindDialog(user);

    expect(await screen.findByText(/no messages to rewind/i)).toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendMessage(claude, user, 'hello');

    await openRewindDialog(user);
    await screen.findByRole('dialog', { name: /rewind/i });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: /rewind/i })).not.toBeInTheDocument();
  });

  it('navigates with arrow keys and selects with Enter', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendMessage(claude, user, 'First');
    await sendMessage(claude, user, 'Second');

    await openRewindDialog(user);
    await screen.findByRole('dialog', { name: /rewind/i });

    const listbox = screen.getByRole('listbox');
    listbox.focus();

    // First item (Second) is focused by default
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    // Arrow down → second item (First)
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    // Arrow up → back to first
    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('listbox has aria-label for accessibility', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendMessage(claude, user, 'hello');

    await openRewindDialog(user);
    await screen.findByRole('dialog', { name: /rewind/i });

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label');
  });

  it('shows confirmation dialog after selecting a message', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendMessage(claude, user, 'hello');

    await openRewindDialog(user);
    await screen.findByRole('dialog', { name: /rewind/i });

    // Click first item
    await user.click(screen.getAllByRole('option')[0]!);

    // Should show confirmation dialog
    const confirmDialog = await screen.findByRole('dialog', { name: /^Rewind code$/ });
    expect(confirmDialog).toBeInTheDocument();
    expect(screen.getByText(/continue/i)).toBeInTheDocument();
    expect(screen.getByText(/never mind/i)).toBeInTheDocument();
  });

  it('excludes user messages without cliUuid (echo not yet received)', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // First message — full echo path (gets cliUuid)
    await sendMessage(claude, user, 'echoed-q');

    // Second message — typed and assistant replies, but no user echo emitted (no cliUuid)
    const textarea = screen.getByPlaceholderText(/Esc to focus/i);
    await user.click(textarea);
    await user.type(textarea, 'pending-q');
    await user.keyboard('{Enter}');
    await emitAssistantTurn(claude, 'Reply to pending');

    await openRewindDialog(user);
    await screen.findByRole('dialog', { name: /rewind/i });

    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('echoed-q');
  });

  it('confirm dialog shows Continue and Never mind buttons', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendMessage(claude, user, 'hello');

    await openRewindDialog(user);
    await screen.findByRole('dialog', { name: /rewind to/i });
    await user.click(screen.getAllByRole('option')[0]!);
    // Phase 2 title is "Rewind" (not "Fork and rewind" — those are separate actions)
    await screen.findByRole('dialog', { name: /^Rewind code$/ });

    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    expect(continueBtn).toBeInTheDocument();
    const neverMindBtn = screen.getByRole('button', { name: 'Never mind' });
    expect(neverMindBtn).toBeInTheDocument();
  });

  it('closes confirmation dialog on "Never mind"', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendMessage(claude, user, 'hello');

    await openRewindDialog(user);
    await screen.findByRole('dialog', { name: /rewind/i });
    await user.click(screen.getAllByRole('option')[0]!);

    await screen.findByRole('dialog', { name: /^Rewind code$/ });
    await user.click(screen.getByText(/never mind/i));

    // Should go back to message list (or close entirely)
    expect(screen.queryByRole('dialog', { name: /^Rewind code$/ })).not.toBeInTheDocument();
  });
});
