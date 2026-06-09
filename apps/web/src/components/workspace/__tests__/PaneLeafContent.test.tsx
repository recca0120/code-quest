/**
 * TG.4: PaneLeafContent rightOpen state — ChatBreadcrumb toggle shows/hides RightPane
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('PaneLeafContent (TG.4) rightOpen toggle via ChatBreadcrumb', () => {
  it('clicking toggle right pane button shows right-pane-body', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });

  it('clicking toggle button again hides right pane body', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
  });

  it('opening toggle shows RightPane with Files tab active by default', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');
  });

  it('switching RightPane tabs after opening works correctly', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');

    await user.click(screen.getByRole('tab', { name: /Git/i }));
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
  });
});
