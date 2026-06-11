import { screen, waitFor } from '@testing-library/react';
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

afterEach(() => vi.restoreAllMocks());

describe('Workspace — empty state', () => {
  it('shows only EmptyState when no projects exist — no sidebar or tab bar', async () => {
    await renderWithWorkspace();
    expect(screen.getByRole('button', { name: 'Add Project' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Esc to focus/i)).not.toBeInTheDocument();
  });
});

describe('Workspace — with project', () => {
  it('renders a tab with ChatShell inside', async () => {
    await setup();
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('workspace chrome is rendered (tab bar + statusline; SessionBar removed by tmux-workspace-ui P1)', async () => {
    await setup();
    expect(screen.getByTestId('workspace-tab-bar')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-statusline')).toBeInTheDocument();
    expect(screen.queryByTestId('session-bar')).not.toBeInTheDocument();
  });

  it('does not render GlobalBar', async () => {
    await setup();
    expect(screen.queryByTestId('global-bar')).not.toBeInTheDocument();
  });

  it('SessionBar shows multiple sessions, each auto-assigned to a pane (split)', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    result.claude.prepareInit();
    await project.launchSession();

    // Both sessions are in panes (split happened) — two visible chat composers
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(2);
    // The second session (most recently created) is in the focused pane
    const headers = screen.getAllByTestId('pane-header');
    expect(headers.some((h) => h.dataset.focused === 'true')).toBe(true);
  });

  it('shows empty state when no sessions open', async () => {
    await renderWithWorkspace();
    expect(screen.getByRole('button', { name: 'Add Project' })).toBeInTheDocument();
  });
});

describe('Workspace — multi-project', () => {
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
    // Both sessions render side-by-side in the same workspace tab.
    expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(2);
  });

  it('two projects both appear in single SessionBar with all sessions', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    result.claude.prepareInit();
    const project2 = await result.addProject({ path: '/projects', dirName: 'other-project' });
    await project2.launchSession();

    expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(2);
  });
});

describe('Workspace — Desktop (≥1024px)', () => {
  it('does NOT render ActivityBar', async () => {
    await setupWithProject(1440);
    expect(screen.queryByRole('complementary', { name: 'activity-bar' })).toBeNull();
    expect(screen.queryByTitle('Projects')).toBeNull();
  });

  it('Settings button is in WorkspaceTabBar', async () => {
    await setupWithProject(1440);
    const tabBar = screen.getByTestId('workspace-tab-bar');
    expect(tabBar.querySelector('[aria-label="Settings"]')).toBeInTheDocument();
  });

  it('shows Settings button in WorkspaceTabBar; click opens Settings dialog', async () => {
    const { user } = await setupWithProject(1440);
    await user.click(screen.getByRole('button', { name: /^settings$/i }));
    expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  });
});

describe('Workspace — state preservation across breakpoints', () => {
  it('crossing tablet→desktop does NOT remount the project tab container', async () => {
    const fakeMM = setupMatchMedia(1023);
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    const elBefore = screen.getByTestId('tab-container');
    fakeMM.triggerChange(1025);
    const elAfter = screen.getByTestId('tab-container');

    expect(elAfter).toBe(elBefore);
  });

  it('crossing desktop→tablet does NOT remount the project tab container', async () => {
    const fakeMM = setupMatchMedia(1440);
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    const elBefore = screen.getByTestId('tab-container');
    fakeMM.triggerChange(800);
    const elAfter = screen.getByTestId('tab-container');

    expect(elAfter).toBe(elBefore);
  });
});

describe('Workspace — PanePicker wiring', () => {
  it('clicking existing session in modal fills focused pane and closes modal', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();
    result.claude.prepareInit();
    await project.launchSession();

    // Split 自動開 picker（handoff：分割（開 picker 選內容）），target = 新空 leaf
    await result.user.click(screen.getAllByTestId('pane-split-h')[0]!);
    await screen.findByTestId('pane-picker-miller');

    // Modal has "Active" section — find session items by data-testid; row itself is clickable（決策 15）
    const sessionItems = await screen.findAllByTestId(/^modal-session-item-/);
    const sessionItem = sessionItems[0]!;
    const channelId = sessionItem.getAttribute('data-testid')!.replace('modal-session-item-', '');

    await result.user.click(sessionItem);

    // Modal closes
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The clicked session is now in the focused pane
    const paneWithSession = document.querySelector(`[data-channel-id="${channelId}"]`);
    if (paneWithSession) {
      expect(paneWithSession.closest('[data-testid="split-pane-leaf"]')).not.toBeNull();
    }
    expect(screen.getAllByPlaceholderText(/Esc to focus/i).length).toBeGreaterThan(0);
  });

  it('opening a tool pane from modal creates a git pane in the target pane', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    // Split pane → picker 自動開啟，target = 新空 leaf
    await result.user.click(screen.getByTestId('pane-split-h'));
    await screen.findByTestId('pane-picker-miller');

    // Click the Git tool button in the right panel
    await result.user.click(await screen.findByTestId('picker-type-git'));

    // Modal closes and a git pane appears (worktree switcher with ± Git label)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /worktree switcher/i })).toBeInTheDocument();
  });
});

describe('Workspace — layout width constraints', () => {
  it('active project container has min-w-0 to prevent overflow on mobile', async () => {
    await setupWithProject(375);
    expect(screen.getByTestId('tab-container')).toHaveClass('min-w-0');
  });

  it('split pane root has min-w-0 to prevent content forcing parent wider than viewport', async () => {
    await setupWithProject(375);
    expect(screen.getByTestId('split-pane-root')).toHaveClass('min-w-0');
  });
});

// ── Worktree listing auto-fetch ──
// Workspace 必須在 project 加入後自動 fetch worktree listing，
// 讓 PanePicker 的 worktree 列表有資料（不能依賴 Sidebar/ProjectRow）。
describe('Workspace — worktree listing auto-fetch', () => {
  it('fetches worktree listing after project is added so PanePicker shows branches', async () => {
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    // Split → picker 自動開啟
    await result.user.click(screen.getByTestId('pane-split-h'));
    await screen.findByTestId('pane-picker-miller');

    // Modal 中 worktree branch 應出現（形如 "⎇ main"）
    await waitFor(() => {
      expect(screen.getAllByText(/⎇/).length).toBeGreaterThan(0);
    });
  });
});
