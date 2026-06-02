import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupMatchMedia } from '@/test/fake-match-media';
import { type RenderWithWorkspaceResult, renderWithWorkspace } from '@/test/render-with-workspace';

async function setup() {
  const result = await renderWithWorkspace();
  const project = await result.addProject();
  await project.launchSession();
  return result;
}

async function setupWithProject(width: number): Promise<RenderWithWorkspaceResult> {
  setupMatchMedia(width);
  return setup();
}

function sidebar() {
  return screen.getByRole('complementary', { name: 'sidebar-panel' });
}
function rightPaneBody() {
  return screen.queryByLabelText('right-pane-body');
}

afterEach(() => vi.restoreAllMocks());

describe('WorkspaceLayout — empty state', () => {
  it('shows only EmptyState when no projects exist — no sidebar or tab bar', async () => {
    await renderWithWorkspace();
    expect(screen.getByRole('button', { name: 'Add Project' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Esc to focus/i)).not.toBeInTheDocument();
  });
});

describe('WorkspaceLayout — with project', () => {
  it('renders a tab with ChatPanel inside', async () => {
    await setup();
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('TabBar is not rendered — tab switching is via sidebar session rows', async () => {
    await setup();
    expect(screen.queryByRole('tablist', { name: 'tab-bar' })).not.toBeInTheDocument();
  });

  it('sidebar shows project list by default', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: /Projects/i })).toBeInTheDocument();
  });

  it('shows empty state when no sessions open', async () => {
    await renderWithWorkspace();
    // No project yet — empty state for project
    expect(screen.getByRole('button', { name: 'Add Project' })).toBeInTheDocument();
  });
});

describe('WorkspaceLayout — multi-project', () => {
  it('second project can be added and shows its chat', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('renders chat panel when project has sessions', async () => {
    await setup();
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('switching project keeps both tab groups mounted', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    result.claude.prepareInit();
    const project2 = await result.addProject({ path: '/projects', dirName: 'other-project' });

    const sidebarEl = screen.getByRole('complementary', { name: 'sidebar-panel' });
    await result.user.click(within(sidebarEl).getByText(/other-project/));
    await project2.launchSession();

    expect(screen.getAllByPlaceholderText(/Esc to focus/i).length).toBe(2);
  });
});

describe('WorkspaceLayout — Desktop (≥1024px)', () => {
  it('does NOT render ActivityBar', async () => {
    await setupWithProject(1440);
    expect(screen.queryByRole('complementary', { name: 'activity-bar' })).toBeNull();
    expect(screen.queryByTitle('Projects')).toBeNull();
  });

  it('renders sidebar as docked column by default', async () => {
    await setupWithProject(1440);
    expect(sidebar()).toBeInTheDocument();
    expect(sidebar()).toHaveAttribute('data-open');
  });

  it('renders the RightPane body visible by default on desktop', async () => {
    await setupWithProject(1440);
    expect(rightPaneBody()).toBeInTheDocument();
  });

  it('shows Toggle sidebar in the topbar', async () => {
    await setupWithProject(1440);
    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument();
  });

  it('shows Toggle right pane button in the chat header', async () => {
    await setupWithProject(1440);
    expect(screen.getByRole('button', { name: /toggle right pane/i })).toBeInTheDocument();
  });

  it('shows Settings button in topbar; click opens Settings dialog', async () => {
    const { user } = await setupWithProject(1440);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });
});

describe('WorkspaceLayout — Tablet (768–1023px)', () => {
  it('sidebar element exists in DOM and starts closed', async () => {
    await setupWithProject(800);
    expect(sidebar()).toBeInTheDocument();
    expect(sidebar()).not.toHaveAttribute('data-open');
  });

  it('right pane starts hidden on tablet', async () => {
    await setupWithProject(800);
    expect(rightPaneBody()).toBeNull();
  });

  it('Toggle sidebar opens then closes the sidebar drawer', async () => {
    const { user } = await setupWithProject(800);
    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-open');
    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));
    expect(sidebar()).not.toHaveAttribute('data-open');
  });

  it('Toggle right pane shows then hides the right pane', async () => {
    const { user } = await setupWithProject(800);
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(rightPaneBody()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(rightPaneBody()).not.toBeInTheDocument();
  });

  it('clicking backdrop closes the sidebar drawer after opening', async () => {
    const { user } = await setupWithProject(800);
    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-open');
    await user.click(screen.getByRole('button', { name: /dismiss sidebar/i }));
    expect(sidebar()).not.toHaveAttribute('data-open');
  });

  it('sidebar has a close button that closes the drawer', async () => {
    const { user } = await setupWithProject(800);
    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-open');
    await user.click(screen.getByRole('button', { name: /close sidebar/i }));
    expect(sidebar()).not.toHaveAttribute('data-open');
  });

  it('shows Settings button in topbar; click opens dialog', async () => {
    const { user } = await setupWithProject(800);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });
});

describe('WorkspaceLayout — Mobile (<768px)', () => {
  it('sidebar starts closed and right pane starts hidden', async () => {
    await setupWithProject(375);
    expect(sidebar()).not.toHaveAttribute('data-open');
    expect(rightPaneBody()).toBeNull();
  });

  it('Toggle sidebar opens then closes drawer on mobile', async () => {
    const { user } = await setupWithProject(375);
    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-open');
    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));
    expect(sidebar()).not.toHaveAttribute('data-open');
  });

  it('Toggle right pane shows then hides right pane on mobile', async () => {
    const { user } = await setupWithProject(375);
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(rightPaneBody()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(rightPaneBody()).not.toBeInTheDocument();
  });

  it('shows Settings button in mobile topbar; click opens dialog', async () => {
    const { user } = await setupWithProject(375);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });
});

describe('WorkspaceLayout — state preservation across breakpoints', () => {
  it('crossing tablet→desktop does NOT remount the project tab container', async () => {
    const fakeMM = setupMatchMedia(1023);
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    const elBefore = screen.getByLabelText('project-container');
    fakeMM.triggerChange(1025);
    const elAfter = screen.getByLabelText('project-container');

    expect(elAfter).toBe(elBefore);
  });

  it('crossing desktop→tablet does NOT remount the project tab container', async () => {
    const fakeMM = setupMatchMedia(1440);
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    const elBefore = screen.getByLabelText('project-container');
    fakeMM.triggerChange(800);
    const elAfter = screen.getByLabelText('project-container');

    expect(elAfter).toBe(elBefore);
  });

  it('crossing desktop→mobile does NOT auto-collapse sidebar or hide right pane', async () => {
    const fakeMM = setupMatchMedia(1440);
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();
    expect(sidebar()).toHaveAttribute('data-open');
    expect(rightPaneBody()).toBeInTheDocument();

    act(() => {
      fakeMM.triggerChange(375);
    });

    expect(sidebar()).toHaveAttribute('data-open');
    expect(rightPaneBody()).toBeInTheDocument();
  });

  it('sidebar element is always present in the DOM (visibility CSS-driven)', async () => {
    setupMatchMedia(800);
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();
    expect(sidebar()).toBeInTheDocument();
  });
});

describe('WorkspaceLayout — layout width constraints', () => {
  it('active project container has min-w-0 to prevent overflow on mobile', async () => {
    await setupWithProject(375);
    expect(screen.getByLabelText('project-container')).toHaveClass('min-w-0');
  });

  it('tab container has min-w-0 to prevent content forcing parent wider than viewport', async () => {
    await setupWithProject(375);
    expect(screen.getByLabelText('tab-container')).toHaveClass('min-w-0');
  });
});
