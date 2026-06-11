/**
 * P1 workspace-chrome（tmux-workspace-ui change）
 * - tab busy 燈：真 channel stream（processing→result）驅動聚合
 * - tab 單擊切換（含 label 文字區）＋雙擊 rename
 * - tab 預設命名＝第一個 pane 的 worktree 名（去前綴）；rename 後不覆寫
 * 全真 pipeline：renderWithWorkspace ＋ FakeGit priming，零自家 mock。
 */
import { createFakeServer, createTestContainer } from '@code-quest/server/test';
import { segments as s } from '@code-quest/test-kit';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { emitAssistantTurn, sendUserMessage } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';

function workspaceTabs(): HTMLElement[] {
  return screen.getAllByTestId('workspace-tab');
}

describe('tab busy 燈（spec: tab busy 燈聚合）', () => {
  it('session 進入 processing 時 tab 亮燈，result 後熄滅', async () => {
    const { user, claude, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    expect(workspaceTabs()[0]).not.toHaveAttribute('data-busy');

    // 真 stream：送訊息 → channel processing → tab 燈亮
    await sendUserMessage(user, 'do something');
    await waitFor(() => expect(workspaceTabs()[0]).toHaveAttribute('data-busy'));

    // assistant + result → busy 熄滅
    await emitAssistantTurn(claude, 'done');
    await waitFor(() => expect(workspaceTabs()[0]).not.toHaveAttribute('data-busy'));
  });
});

describe('tab 單擊切換／雙擊 rename（spec: 單擊切換、雙擊改名）', () => {
  it('點 label 文字也能切換 tab（修 stopPropagation bug）', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await user.click(screen.getByTestId('workspace-tab-add'));
    expect(workspaceTabs()[1]).toHaveAttribute('data-active');

    // 點第一個 tab 的 label「文字」——不是 tab 邊緣
    await user.click(within(workspaceTabs()[0]!).getByTestId('workspace-tab-label'));
    expect(workspaceTabs()[0]).toHaveAttribute('data-active');
    expect(workspaceTabs()[1]).not.toHaveAttribute('data-active');
  });

  it('雙擊 label 進入 rename，Enter 確認', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await user.dblClick(within(workspaceTabs()[0]!).getByTestId('workspace-tab-label'));
    const input = within(workspaceTabs()[0]!).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'My Work{Enter}');
    expect(screen.getByText('My Work')).toBeInTheDocument();
  });
});

describe('tab 預設命名（spec: 預設＝第一個 pane 的 worktree 名去前綴）', () => {
  it('開啟 worktree session 後，tab label 顯示去前綴的 worktree 名', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    summoner.git()!.setProjectRoot('/projects/app');
    summoner.git()!.markAsRepo?.('/projects/app');
    summoner.git()!.addWorktree({
      name: 'discuss-layout',
      path: '/projects/app/.worktrees/discuss-layout',
      branch: 'feat/discuss-layout',
    });

    const view = await renderWithWorkspace({ summoner });
    const project = await view.addProject({ path: '/projects', dirName: 'app' });
    await project.launchSession();

    // launchSession 開在 project root（branch main 經 lookup）→ label = main worktree 名
    // 此測試聚焦規則本身：tab label 不再是 "Tab 1"，而是反映 worktree
    await waitFor(() => {
      const label = workspaceTabs()[0]!.textContent ?? '';
      expect(label).not.toMatch(/Tab 1/);
    });
  });

  it('使用者 rename 過的 tab 不被自動命名覆寫（label 永遠優先於推導名）', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // rename：即使 tab 的第一個 pane 有 cwd（會推導出 worktree 名），命名後仍顯示命名
    await user.dblClick(within(workspaceTabs()[0]!).getByTestId('workspace-tab-label'));
    const input = within(workspaceTabs()[0]!).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Named{Enter}');

    expect(screen.getByText('Named')).toBeInTheDocument();
    expect(within(workspaceTabs()[0]!).getByTestId('workspace-tab-label')).toHaveTextContent(
      'Named',
    );
  });
});

describe('底部狀態列（spec: focused pane 決定狀態列 context）', () => {
  it('顯示 focused pane 的 project ⎇ branch；focus 切換即更新；busy 聚合', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    summoner.git()!.setProjectRoot('/projects/app');
    summoner.git()!.addWorktree({ name: 'app', path: '/projects/app', branch: 'main' });
    summoner.git()!.addWorktree({
      name: 'feat',
      path: '/projects/app/.worktrees/feat',
      branch: 'feat/x',
    });

    const { user, claude, addProject } = await renderWithWorkspace({ summoner });
    const project = await addProject({ path: '/projects', dirName: 'app' });
    await project.launchSession();

    // focused pane = 剛開的 session（cwd=/projects/app）→ app ⎇ main
    const statusline = screen.getByTestId('workspace-statusline');
    await waitFor(() => {
      expect(within(statusline).getByTestId('statusline-context')).toHaveTextContent('app');
      expect(within(statusline).getByTestId('statusline-context')).toHaveTextContent('⎇ main');
    });

    // busy 聚合（單 session 階段）：processing → "1 busy" → result 熄滅
    expect(within(statusline).queryByTestId('statusline-busy')).not.toBeInTheDocument();
    await sendUserMessage(user, 'work');
    await waitFor(() =>
      expect(within(statusline).getByTestId('statusline-busy')).toHaveTextContent('1 busy'),
    );
    await emitAssistantTurn(claude, 'ok');
    await waitFor(() =>
      expect(within(statusline).queryByTestId('statusline-busy')).not.toBeInTheDocument(),
    );

    // 從 manager 在 feat worktree 開第二個 session → focused 變新 pane → ⎇ feat/x
    await user.keyboard('{Meta>}{Shift>}M{/Shift}{/Meta}');
    const featRow = (await screen.findByText('⎇ feat/x')).closest('[data-testid^="worktree-row"]');
    await user.click(within(featRow as HTMLElement).getByTestId('new-session-btn'));
    await waitFor(() =>
      expect(within(statusline).getByTestId('statusline-context')).toHaveTextContent('⎇ feat/x'),
    );

    // 點回第一個 pane → 回到 main
    const leaves = screen.getAllByTestId('split-pane-leaf');
    await user.click(leaves[0]!);
    await waitFor(() =>
      expect(within(statusline).getByTestId('statusline-context')).toHaveTextContent('⎇ main'),
    );
  });

  it('快捷鍵提示與 KeyboardShortcutsProvider 同源', async () => {
    const { addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    const statusline = screen.getByTestId('workspace-statusline');
    // 單一來源常數的代表項（⌘K picker 於 P2 綁定後加入 hints）
    expect(within(statusline).getByText(/⌘⇧Z/)).toBeInTheDocument();
    expect(within(statusline).getByText(/⌘⇧M/)).toBeInTheDocument();
  });
});

describe('PanePicker 全管線（P2：⌘K／標準工作組）', () => {
  it('⌘K 開啟 picker；標準工作組一鍵建 chat＋files＋git 三 pane', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // ⌘K（KeyboardShortcutsProvider 真綁定）
    await user.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findByTestId('pane-picker-miller')).toBeInTheDocument();

    // 標準工作組：focused pane 開 chat、右側直欄 files/git
    await user.click(screen.getByTestId('picker-combo-standard'));
    await waitFor(() => expect(screen.getAllByTestId('split-pane-leaf').length).toBe(4));
    // files 與 git pane 都在（rail 內也有 files/git view → 用 getAllBy 不取唯一）
    expect(screen.getAllByRole('region', { name: 'files-pane' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('region', { name: 'git-pane' }).length).toBeGreaterThan(0);
  });
});

describe('permission mode pane 邊框派發（6.5；spec: focused 樣式與 permission mode 換色）', () => {
  it('init 帶 plan mode 的 session，其 pane wrapper 取得 data-mode="plan"', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    summoner
      .claude()
      .prepareInit(
        s.init('sess-plan', { permissionMode: 'plan' }),
        s.controlResponse('init', { models: [] }),
      );

    const view = await renderWithWorkspace({ summoner });
    const project = await view.addProject();
    await project.launchSession();

    await waitFor(() => {
      expect(screen.getByTestId('split-pane-leaf')).toHaveAttribute('data-mode', 'plan');
    });
  });
});
