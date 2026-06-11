/**
 * P1 workspace-chrome（tmux-workspace-ui change）
 * - tab busy 燈：真 channel stream（processing→result）驅動聚合
 * - tab 單擊切換（含 label 文字區）＋雙擊 rename
 * - tab 預設命名＝第一個 pane 的 worktree 名（去前綴）；rename 後不覆寫
 * 全真 pipeline：renderWithWorkspace ＋ FakeGit priming，零自家 mock。
 */
import { EVENTS } from '@code-quest/schemas';
import { createFakeServer, createTestContainer } from '@code-quest/server/test';
import { segments as s } from '@code-quest/test-kit';
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { emitAssistantTurn, sendUserMessage } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';
import { WORKSPACE_SHORTCUT_HINTS } from '../KeyboardShortcutsProvider';

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

  it('busy 時 tab 內亮 busy dot（animate-busy-pulse）；result 後消失', async () => {
    const { user, claude, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    expect(
      within(workspaceTabs()[0]!).queryByTestId('workspace-tab-busy-dot'),
    ).not.toBeInTheDocument();

    await sendUserMessage(user, 'work');
    await waitFor(() => {
      const dot = within(workspaceTabs()[0]!).getByTestId('workspace-tab-busy-dot');
      expect(dot.className).toContain('animate-busy-pulse');
    });

    await emitAssistantTurn(claude, 'done');
    await waitFor(() =>
      expect(
        within(workspaceTabs()[0]!).queryByTestId('workspace-tab-busy-dot'),
      ).not.toBeInTheDocument(),
    );
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
    const { user, summoner, addProject } = await renderWithWorkspace();
    const project = await addProject({ path: '/projects', dirName: 'app' });
    await project.launchSession();

    // launchSession 開在 main worktree → 預設名經 lookup 推導為 'main'（非 "Tab 1"）
    await waitFor(() =>
      expect(within(workspaceTabs()[0]!).getByTestId('workspace-tab-label')).toHaveTextContent(
        /^main$/,
      ),
    );

    // 真管線建 worktree（git:worktree:add → broadcast → listing）。path 尾段（wt-1）
    // 與 branch 尾段（discuss-layout）刻意不同：label 只可能來自 lookup 的去前綴 branch
    await act(async () => {
      await summoner.send(EVENTS.git.worktree.add, {
        cwd: '/projects/app',
        name: 'wt-1',
        newBranch: 'feat/discuss-layout',
      });
    });

    // 新 workspace tab（空 pane）→ ⌘⇧M 從 discuss-layout row 開 session
    await user.click(screen.getByTestId('workspace-tab-add'));
    await user.keyboard('{Meta>}{Shift>}M{/Shift}{/Meta}');
    const row = (await screen.findByText('⎇ feat/discuss-layout')).closest(
      '[data-testid^="worktree-row"]',
    );
    await user.click(within(row as HTMLElement).getByTestId('new-session-btn'));

    // session 落新 tab 第一個 pane → label = 去 feat/ 前綴的 'discuss-layout'
    //（^$ 錨定：保留前綴的 'feat/discuss-layout' 不可過）
    await waitFor(() =>
      expect(within(workspaceTabs()[1]!).getByTestId('workspace-tab-label')).toHaveTextContent(
        /^discuss-layout$/,
      ),
    );
    expect(within(workspaceTabs()[0]!).getByTestId('workspace-tab-label')).toHaveTextContent(
      /^main$/,
    );
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

  it('兩 session 同時 processing → "2 busy"；一個 result → "1 busy"', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    summoner.claude().prepareInit(s.init('sess-busy-a'));

    const { user, claude, addProject } = await renderWithWorkspace({ summoner });
    const project = await addProject();
    await project.launchSession();

    const statusline = screen.getByTestId('workspace-statusline');
    await sendUserMessage(user, 'first task');
    await waitFor(() =>
      expect(within(statusline).getByTestId('statusline-busy')).toHaveTextContent('1 busy'),
    );

    // 第二個 channel：再 prepareInit 一次（獨立 session id）→ manager 開第二個 session
    claude.prepareInit(s.init('sess-busy-b'));
    await user.keyboard('{Meta>}{Shift>}M{/Shift}{/Meta}');
    const newSessionBtns = await screen.findAllByTestId('new-session-btn');
    await user.click(newSessionBtns[0]!);
    await waitFor(() => expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2));

    // 新 session pane 取得 focus → 在它的 composer 送訊息 → 兩個同時 processing
    //（processing 中的 session 1 composer placeholder 已變 "Queue another message…"，
    //  /Esc to focus/ 只會命中 idle 的新 session）
    const focusedLeaf = screen
      .getAllByTestId('split-pane-leaf')
      .find((leaf) => leaf.hasAttribute('data-focused'));
    const composer2 = await within(focusedLeaf as HTMLElement).findByPlaceholderText(
      /Esc to focus/i,
    );
    await user.click(composer2);
    await user.type(composer2, 'second task');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(within(statusline).getByTestId('statusline-busy')).toHaveTextContent('2 busy'),
    );

    // 後開的 session（provider.latest）回 result → 只剩 1 busy（另一個還在跑）
    await emitAssistantTurn(claude, 'done');
    await waitFor(() =>
      expect(within(statusline).getByTestId('statusline-busy')).toHaveTextContent('1 busy'),
    );
  });

  it('快捷鍵提示與 KeyboardShortcutsProvider 同源', async () => {
    const { addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    const statusline = screen.getByTestId('workspace-statusline');
    // 單一來源：常數的每一條 keys＋label 都必須出現在狀態列
    for (const hint of WORKSPACE_SHORTCUT_HINTS) {
      expect(
        within(statusline).getByText((_, el) => el?.textContent === `${hint.keys} ${hint.label}`),
      ).toBeInTheDocument();
    }
  });
});

describe('CommandPalette（⌘⇧K；⌘K 讓位給 PanePicker）', () => {
  it('⌘⇧K 開 palette（非 picker）；esc 關閉', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // palette hotkey 走 NO_FORM（composer 聚焦時不觸發）→ 先點空白處移出焦點
    await user.click(document.body);
    // useHotkeys 的 mod 在非 mac（jsdom）解析為 Ctrl
    await user.keyboard('{Control>}{Shift>}K{/Shift}{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Command Palette' })).toBeInTheDocument();
    // 開的是 palette 不是 picker（⌘K 才是 picker）
    expect(screen.queryByTestId('pane-picker-miller')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Command Palette' })).not.toBeInTheDocument(),
    );
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

  it('git list 失敗的 project：欄2 顯示空清單而非 loading；正常 repo 照列', async () => {
    const { user, summoner, addProject } = await renderWithWorkspace();
    const project = await addProject({ path: '/projects', dirName: 'app' });
    await project.launchSession();

    // 第二個 project 手動走 UI 加入、刻意不 priming git repo（不 markAsRepo）：
    // getProjectRoot 指向 /projects/plain → listWorktrees 擲 NotARepoError → list 回 error
    summoner.filesystem().addDirectory('/projects', ['app', 'plain']);
    summoner.git()!.setProjectRoot('/projects/plain');
    await user.click(screen.getByRole('button', { name: /add project/i }));
    await user.click(await screen.findByRole('treeitem', { name: 'projects' }));
    await user.click(await screen.findByRole('treeitem', { name: 'plain' }));
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await user.keyboard('{Meta>}k{/Meta}');
    await screen.findByTestId('pane-picker-miller');
    const col1 = screen.getByTestId('pane-picker-col-projects');
    const col2 = screen.getByTestId('pane-picker-col-worktrees');

    // 選非 repo 的 project → error ≠ loading：不顯 loading、worktree 清單空
    await user.click(await within(col1).findByRole('button', { name: /plain/ }));
    await waitFor(() => {
      expect(within(col2).queryByTestId('picker-worktrees-loading')).not.toBeInTheDocument();
      const worktreeRows = within(col2)
        .queryAllByRole('button')
        .filter((b) => b.textContent?.includes('⎇'));
      expect(worktreeRows).toHaveLength(0);
    });

    // 對照組：切回正常 repo → worktrees 照列（同一個 picker、同一份 allWorktrees）
    await user.click(within(col1).getByRole('button', { name: /app/ }));
    await waitFor(() => expect(within(col2).getByText('main')).toBeInTheDocument());
  });
});

describe('⌘K target-pane 路由（picker 開到 focused pane）', () => {
  it('split 後 focus 第二 leaf → ⌘K → 鍵盤選 git ⏎ → git pane 落第二 leaf、第一 leaf 不變', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // ⌘D 分割（自動開 picker）→ esc 關閉，新 leaf 留空
    await user.keyboard('{Meta>}d{/Meta}');
    await screen.findByTestId('pane-picker-miller');
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('pane-picker-miller')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);

    // focus 第二（空）leaf
    await user.click(screen.getAllByTestId('split-pane-leaf')[1]!);
    await waitFor(() =>
      expect(screen.getAllByTestId('split-pane-leaf')[1]).toHaveAttribute('data-focused'),
    );

    // ⌘K → 鍵盤導航：欄3 起點 chat(0) → ↓↓ 到 git(2) → ⏎
    await user.keyboard('{Meta>}k{/Meta}');
    await screen.findByTestId('pane-picker-miller');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    // git pane 落在第二 leaf；picker 關閉；第一 leaf 的 chat 不受影響
    await waitFor(() => {
      const leaves = screen.getAllByTestId('split-pane-leaf');
      expect(within(leaves[1]!).getByRole('region', { name: 'git-pane' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('pane-picker-miller')).not.toBeInTheDocument();
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(within(leaves[0]!).getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    expect(within(leaves[0]!).queryByRole('region', { name: 'git-pane' })).not.toBeInTheDocument();
  });
});

describe('分割自動開 picker（handoff：分割（開 picker 選內容））', () => {
  it('⌘D 分割後自動開 picker；targetPaneId=新 leaf（選 git 落在新 leaf）', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    await user.keyboard('{Meta>}d{/Meta}');

    // 分割成功＋picker 自動開啟
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    expect(await screen.findByTestId('pane-picker-miller')).toBeInTheDocument();

    // picker 的 target 是新 leaf：選 git 類型卡 → git pane 落在第二個（新）leaf
    await user.click(screen.getByTestId('picker-type-git'));
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(within(leaves[1]!).getByRole('region', { name: 'git-pane' })).toBeInTheDocument();
    // 原 leaf 的 chat 不受影響
    expect(within(leaves[0]!).getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('pane header 分割鈕（◫）分割後也自動開 picker', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    await user.click(screen.getByTestId('pane-split-h'));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    expect(await screen.findByTestId('pane-picker-miller')).toBeInTheDocument();

    // esc 關閉 picker → 新 leaf 維持空 pane
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('pane-picker-miller')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-pane')).toBeInTheDocument();
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
