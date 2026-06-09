/**
 * CT2.2/CT2.3: PaneLeafContent activeTool state — clicking tool icons shows/hides RightPane
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('PaneLeafContent (CT2.2/CT2.3) activeTool state', () => {
  it('clicking git icon shows right pane body', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    await user.click(screen.getByRole('button', { name: /Git/i }));
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });

  it('clicking same icon again hides right pane body', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const { launchSession } = await addProject();
    await launchSession();

    await user.click(screen.getByRole('button', { name: /Git/i }));
    await user.click(screen.getByRole('button', { name: /Git/i }));
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
  });
});
