/**
 * TG.4: PaneLeafContent rightOpen state — ChatBreadcrumb toggle shows/hides RightPane
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('PaneLeafContent (TG.4) rail toggle via ChatBreadcrumb（P3：預設展開）', () => {
  it('rail 預設展開（handoff：新 chat 預設展開側欄）', async () => {
    const { addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });

  it('clicking toggle hides the rail (collapses to dock)', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
    expect(screen.getByTestId('pane-dock')).toBeInTheDocument();
  });

  it('rail shows Files tab active by default', async () => {
    const { addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');
  });

  it('switching RightPane tabs works correctly', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');

    await user.click(screen.getByRole('tab', { name: /Git/i }));
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
  });
});
