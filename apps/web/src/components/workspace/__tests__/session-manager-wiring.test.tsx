/**
 * SessionManager 接線（worktree-centric entry-wiring 3.1-3.4）— 全真管線。
 *
 * 慣例（fake-summoner-client skill）：renderWithWorkspace 跑真 Workspace 組合
 * （KeyboardShortcutsProvider → SessionManager → pendingSession → TabContainer
 * → ChannelProvider → session:launch）。不 mock GitContext/ProjectContext：
 * worktree 經 FakeGit priming、project 走 AddProjectDialog 真 UI 流程進入。
 * 多層驗證：① UI（manager 列表/chat pane）② summoner.sentEvents('session:launch')
 * ③ container ChannelManager。
 */
import { createFakeServer, createTestContainer, TYPES } from '@code-quest/server/test';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { type RenderWithWorkspaceResult, renderWithWorkspace } from '@/test/render-with-workspace';

const PROJECT_CWD = '/work/myapp';
const FEAT_CWD = '/work/myapp/feat';

/**
 * feat worktree 先入 FakeGit，addProject 後 listing 為 [feat/x, main]——
 * launchSession（PanePicker 首列）因此落在 feat worktree。
 */
async function setupWorkspaceWithFeatSession() {
  const container = createTestContainer();
  const server = createFakeServer(container);
  onTestFinished(() => server.destroy());
  const summoner = createFakeSummoner(server);

  const view = await renderWithWorkspace({ summoner });
  summoner.git()!.addWorktree({ path: FEAT_CWD, branch: 'feat/x', name: 'feat' });
  const project = await view.addProject({ path: '/work', dirName: 'myapp' });
  const ch1 = await project.launchSession();
  return { ...view, container, ch1 };
}

async function openSessionManager(user: RenderWithWorkspaceResult['user']): Promise<HTMLElement> {
  await user.keyboard('{Meta>}{Shift>}M{/Shift}{/Meta}');
  return screen.findByTestId('session-manager');
}

/**
 * Projects 區的 worktree 列（含該列的 + New session）。
 * session-manager-item-* 同時出現在 tab-group 區與 Projects 區，
 * 所以從 new-session-btn（只存在於 Projects 列）反查所屬列。
 */
function projectsRowByBranch(manager: HTMLElement, branch: string): HTMLElement {
  const row = within(manager)
    .getAllByTestId('new-session-btn')
    .map((btn) => btn.closest('div') as HTMLElement)
    .find((div) => div.textContent?.includes(`⎇ ${branch}`));
  if (!row) throw new Error(`No Projects row for branch ${branch}`);
  return row;
}

describe('SessionManager Projects 區 — 一對多（3.3/3.4）', () => {
  it('同 worktree 兩個 sessions 都列在同一列，且 + New session 恆常可按（真 session:launch）', async () => {
    const { summoner, user, container, ch1 } = await setupWorkspaceWithFeatSession();

    // 第一個 session 確實落在 feat worktree（後續為「同 worktree」場景）
    expect(summoner.sentEvents('session:launch')[0]).toMatchObject({ cwd: FEAT_CWD });

    // 已有 session 的 worktree 列，+ New session 仍可按 → 建第二個 session
    let manager = await openSessionManager(user);
    const featRowBefore = projectsRowByBranch(manager, 'feat/x');
    expect(within(featRowBefore).getByTestId(`session-manager-item-${ch1}`)).toBeInTheDocument();
    await user.click(within(featRowBefore).getByTestId('new-session-btn'));

    // ② socket：真管線為「新 channel」送出 session:launch，cwd 帶該 worktree。
    // （split 會 remount 既有 pane 的 ChannelProvider 重發 ch1 的 launch——
    //   被 server 的 Channel already exists 守門擋下，故以 channelId 區分而非數總量）
    const newLaunches = () =>
      (summoner.sentEvents('session:launch') as Array<{ channelId: string; cwd?: string }>).filter(
        (p) => p.channelId !== ch1,
      );
    await waitFor(() => expect(newLaunches()).toHaveLength(1));
    expect(newLaunches()[0]).toMatchObject({ cwd: FEAT_CWD });
    const ch2 = newLaunches()[0]!.channelId;

    // ① UI：第二個 session 真的開起來（split 出第二個 chat pane）
    await waitFor(() => expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(2));

    // 重開 manager：同 worktree 列同時列出兩個 sessions，+ New session 仍在（恆常可用）
    manager = await openSessionManager(user);
    const featRow = projectsRowByBranch(manager, 'feat/x');
    expect(within(featRow).getByTestId(`session-manager-item-${ch1}`)).toBeInTheDocument();
    expect(within(featRow).getByTestId(`session-manager-item-${ch2}`)).toBeInTheDocument();
    expect(within(featRow).getByTestId('new-session-btn')).toBeInTheDocument();

    // ③ server：兩個 channel 都真的活著（按鈕不是 no-op、也沒有重複 spawn）
    const channelManager = container.get<{ getAliveChannels(): unknown[] }>(TYPES.ChannelManager);
    expect(channelManager.getAliveChannels()).toHaveLength(2);
  });
});

describe('KeyboardShortcutsProvider 轉交 handlers（3.1/3.2）', () => {
  it('⌘⇧M 開啟後點 + New session — manager 關閉，該 worktree 真的 launch', async () => {
    const { summoner, user, ch1 } = await setupWorkspaceWithFeatSession();

    // 3.1：⌘⇧M 開啟 overlay
    const manager = await openSessionManager(user);
    expect(manager).toBeInTheDocument();

    // 點 main worktree（無 session）那列 → 轉交 Workspace handler 後 manager 立即關閉
    await user.click(within(projectsRowByBranch(manager, 'main')).getByTestId('new-session-btn'));
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();

    // 3.2：真 handler 鏈（pendingSession → TabContainer → ChannelProvider）
    // 為新 channel 送出 session:launch，cwd 是被點的那列（main worktree = project root）
    const newLaunches = () =>
      (summoner.sentEvents('session:launch') as Array<{ channelId: string; cwd?: string }>).filter(
        (p) => p.channelId !== ch1,
      );
    await waitFor(() => expect(newLaunches()).toHaveLength(1));
    expect(newLaunches()[0]).toMatchObject({ cwd: PROJECT_CWD });

    // 新 session 真的開起來（split 出第二個 chat pane）
    await waitFor(() => expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(2));
  });
});
