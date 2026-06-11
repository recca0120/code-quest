/**
 * TG.4: PaneLeafContent rightOpen state — ChatBreadcrumb toggle shows/hides RightPane
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('PaneLeafContent (TG.4) rail toggle（單一 pane header；chat-pane-header-unification）', () => {
  it('☰/⊞ 按鈕在 pane header 內（breadcrumb 已移除——單一 header）', async () => {
    const { addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    const header = screen.getAllByTestId('pane-header')[0]!;
    expect(within(header).getByRole('button', { name: /toggle right pane/i })).toBeInTheDocument();
    // breadcrumb 整條移除
    expect(screen.queryByLabelText('chat-breadcrumb')).not.toBeInTheDocument();
  });

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
