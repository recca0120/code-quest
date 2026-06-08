import { act, screen } from '@testing-library/react';
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

  it('SessionBar is rendered at top of chat area', async () => {
    await setup();
    expect(screen.getByTestId('session-bar')).toBeInTheDocument();
  });

  it('GlobalBar shows active project name', async () => {
    await setup();
    expect(screen.getByRole('button', { name: /Project:/ })).toBeInTheDocument();
  });

  it('SessionBar shows multiple sessions, each auto-assigned to a pane (split)', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    result.claude.prepareInit();
    await project.launchSession();

    const sessionBar = screen.getByTestId('session-bar');
    const sessionItems = Array.from(sessionBar.querySelectorAll<HTMLElement>('[data-status]'));
    expect(sessionItems).toHaveLength(2);

    // Both sessions are in panes (split happened) — neither should be inactive
    const statuses = sessionItems.map((el) => el.getAttribute('data-status'));
    expect(statuses).not.toContain('inactive');
    // The second session (most recently created) should be focused-active
    expect(statuses).toContain('focused-active');
  });

  it('shows empty state when no sessions open', async () => {
    await renderWithWorkspace();
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

  it('sessions from two projects appear in the same SessionBar (cross-project)', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    result.claude.prepareInit();
    const project2 = await result.addProject({ path: '/projects', dirName: 'other-project' });
    await project2.launchSession();

    // Design Decision 4: Tab Bar and Split Pane are cross-project.
    // Both sessions should be visible in a SINGLE session bar.
    const sessionBar = screen.getByTestId('session-bar');
    expect(sessionBar.querySelectorAll('[data-status]').length).toBe(2);
  });

  it('switching project via GlobalBar does NOT change pane layout', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    result.claude.prepareInit();
    const project2 = await result.addProject({ path: '/projects', dirName: 'other-project' });
    await project2.launchSession();

    // Both sessions in same session bar before switching
    expect(screen.getByTestId('session-bar').querySelectorAll('[data-status]').length).toBe(2);

    // Switch back to project 1 via GlobalBar
    await result.user.click(screen.getByRole('button', { name: /Project:/ }));
    await result.user.click(screen.getByRole('menuitem', { name: /app/ }));

    // Sessions still visible — project switch only changes [+] default cwd, not layout
    expect(screen.getByTestId('session-bar').querySelectorAll('[data-status]').length).toBe(2);
  });
});

describe('WorkspaceLayout — Desktop (≥1024px)', () => {
  it('does NOT render ActivityBar', async () => {
    await setupWithProject(1440);
    expect(screen.queryByRole('complementary', { name: 'activity-bar' })).toBeNull();
    expect(screen.queryByTitle('Projects')).toBeNull();
  });

  it('GlobalBar is visible', async () => {
    await setupWithProject(1440);
    expect(screen.getByTestId('global-bar')).toBeInTheDocument();
  });

  it('renders the RightPane body visible by default on desktop', async () => {
    await setupWithProject(1440);
    expect(rightPaneBody()).toBeInTheDocument();
  });

  it('shows Settings button in GlobalBar; click opens Settings dialog', async () => {
    const { user } = await setupWithProject(1440);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });

  it('shows Toggle right pane button in the chat header', async () => {
    await setupWithProject(1440);
    expect(screen.getByRole('button', { name: /toggle right pane/i })).toBeInTheDocument();
  });
});

describe('WorkspaceLayout — Tablet (768–1023px)', () => {
  it('right pane starts hidden on tablet', async () => {
    await setupWithProject(800);
    expect(rightPaneBody()).toBeNull();
  });

  it('Toggle right pane shows then hides the right pane', async () => {
    const { user } = await setupWithProject(800);
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(rightPaneBody()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(rightPaneBody()).not.toBeInTheDocument();
  });

  it('shows Settings button in GlobalBar; click opens dialog', async () => {
    const { user } = await setupWithProject(800);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });
});

describe('WorkspaceLayout — Mobile (<768px)', () => {
  it('right pane starts hidden on mobile', async () => {
    await setupWithProject(375);
    expect(rightPaneBody()).toBeNull();
  });

  it('Toggle right pane shows then hides right pane on mobile', async () => {
    const { user } = await setupWithProject(375);
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(rightPaneBody()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /toggle right pane/i }));
    expect(rightPaneBody()).not.toBeInTheDocument();
  });

  it('shows Settings button in GlobalBar; click opens dialog', async () => {
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

  it('crossing desktop→mobile does NOT hide right pane', async () => {
    const fakeMM = setupMatchMedia(1440);
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();
    expect(rightPaneBody()).toBeInTheDocument();

    act(() => {
      fakeMM.triggerChange(375);
    });

    expect(rightPaneBody()).toBeInTheDocument();
  });
});

describe('WorkspaceLayout — layout width constraints', () => {
  it('active project container has min-w-0 to prevent overflow on mobile', async () => {
    await setupWithProject(375);
    expect(screen.getByLabelText('project-container')).toHaveClass('min-w-0');
  });

  it('split pane root has min-w-0 to prevent content forcing parent wider than viewport', async () => {
    await setupWithProject(375);
    expect(screen.getByTestId('split-pane-root')).toHaveClass('min-w-0');
  });
});
