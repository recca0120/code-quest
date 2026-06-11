/**
 * PanePicker — Miller 三欄（tmux-workspace-ui P2；handoff §4 乙案）。
 * Leaf component 測試：props 是公開介面，callbacks 以 spy 驗證參數；
 * 鍵盤協定（←→↑↓⏎⌘⏎／快捷字母／⌘1）走真 userEvent。
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanePicker } from '@/components/workspace/PanePicker';

const sessions = [
  {
    channelId: 'ch-1',
    title: 'Task A',
    status: 'idle' as const,
    branch: 'main',
    cwd: '/projects/app',
  },
  {
    channelId: 'ch-2',
    title: 'Task B',
    status: 'busy' as const,
    branch: 'feat-x',
    cwd: '/projects/app-feat',
    paneLabel: 'Left pane',
  },
];

const pastSessions = [
  {
    id: 'past-1',
    channelId: 'ch-old',
    title: 'Old task',
    cwd: '/projects/app',
    createdAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
  },
  {
    id: 'past-2',
    channelId: 'ch-older',
    title: 'Other worktree task',
    cwd: '/projects/app-feat',
    createdAt: new Date(Date.now() - 3600_000 * 30).toISOString(),
  },
];

const projects = [
  { cwd: '/projects/app', name: 'app' },
  { cwd: '/projects/other', name: 'other' },
];

const allWorktrees = {
  '/projects/app': [
    { path: '/projects/app', branch: 'main', name: 'main' },
    { path: '/projects/app-feat', branch: 'feat-x', name: 'feat-x' },
  ],
  '/projects/other': [{ path: '/projects/other', branch: 'dev', name: 'dev' }],
};

function setup(overrides: Partial<React.ComponentProps<typeof PanePicker>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    sessions,
    pastSessions,
    projects,
    allWorktrees,
    activeProjectCwd: '/projects/app',
    onShowHere: vi.fn(),
    onResume: vi.fn(),
    onNewSession: vi.fn(),
    onOpenToolPane: vi.fn(),
    onOpenCombo: vi.fn(),
    onNewWorktree: vi.fn(),
    onImport: vi.fn(),
    onAddProject: vi.fn(),
    ...overrides,
  };
  render(<PanePicker {...props} />);
  return props;
}

const col = {
  projects: () => screen.getByTestId('pane-picker-col-projects'),
  worktrees: () => screen.getByTestId('pane-picker-col-worktrees'),
  content: () => screen.getByTestId('pane-picker-col-content'),
};

describe('PanePicker — open/close', () => {
  it('renders the Miller layout when open', () => {
    setup();
    expect(screen.getByTestId('pane-picker-miller')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    setup({ open: false });
    expect(screen.queryByTestId('pane-picker-miller')).not.toBeInTheDocument();
  });
});

describe('三欄資料源與聯動（spec: Miller 三欄結構）', () => {
  it('欄1 列出 projects；active project 預選', () => {
    setup();
    const c = col.projects();
    expect(within(c).getByText('app')).toBeInTheDocument();
    expect(within(c).getByText('other')).toBeInTheDocument();
    expect(within(c).getByText('app').closest('button')).toHaveAttribute('data-active');
  });

  it('欄2 列出選定 project 的 worktrees（chats 數＋busy）', () => {
    setup();
    const c = col.worktrees();
    expect(within(c).getByText('main')).toBeInTheDocument();
    expect(within(c).getByText('feat-x')).toBeInTheDocument();
    expect(within(c).getByText(/busy/)).toBeInTheDocument(); // feat-x 有 busy session
  });

  it('點欄1 另一個 project → 欄2 跟著換', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(within(col.projects()).getByText('other'));
    expect(within(col.worktrees()).getByText('dev')).toBeInTheDocument();
    expect(within(col.worktrees()).queryByText('feat-x')).not.toBeInTheDocument();
  });

  it('listing 尚未載入（undefined）顯示 loading 態，不是空白（6.5）', () => {
    setup({ allWorktrees: {} });
    expect(screen.getByTestId('picker-worktrees-loading')).toBeInTheDocument();
  });

  it('欄3 由 registry 渲染類型 grid（chat/files/git/spec）', () => {
    setup();
    for (const key of ['chat', 'files', 'git', 'openspec']) {
      expect(screen.getByTestId(`picker-type-${key}`)).toBeInTheDocument();
    }
  });
});

describe('進行中／resume／組合（spec: 欄3 sections）', () => {
  it('進行中只列選定 worktree 的 sessions；busy 標示；Show here 帶 targetPaneId', async () => {
    const user = userEvent.setup();
    const props = setup({ targetPaneId: 'pane-7' });
    // 預設 worktree = main（/projects/app）→ 只有 Task A
    expect(screen.getByTestId('modal-session-item-ch-1')).toBeInTheDocument();
    expect(screen.queryByTestId('modal-session-item-ch-2')).not.toBeInTheDocument();

    await user.click(within(screen.getByTestId('modal-session-item-ch-1')).getByText('Show here'));
    expect(props.onShowHere).toHaveBeenCalledWith('ch-1', 'pane-7');

    // 切到 feat-x → Task B（busy ●＋paneLabel）
    await user.click(within(col.worktrees()).getByText('feat-x'));
    const item = screen.getByTestId('modal-session-item-ch-2');
    expect(within(item).getByText('●')).toBeInTheDocument();
    expect(within(item).getByText(/Left pane/)).toBeInTheDocument();
  });

  it('resume 列表只列選定 worktree 的歷史，點擊呼叫 onResume(sessionId)', async () => {
    const user = userEvent.setup();
    const props = setup();
    expect(screen.getByTestId('picker-resume-item-past-1')).toBeInTheDocument();
    expect(screen.queryByTestId('picker-resume-item-past-2')).not.toBeInTheDocument();
    expect(screen.getByText(/5h ago/)).toBeInTheDocument();

    await user.click(screen.getByTestId('picker-resume-item-past-1'));
    expect(props.onResume).toHaveBeenCalledWith('past-1');
  });

  it('標準工作組（⌘1 卡片）呼叫 onOpenCombo(cwd, projectCwd)', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByTestId('picker-combo-standard'));
    expect(props.onOpenCombo).toHaveBeenCalledWith('/projects/app', '/projects/app');
  });
});

describe('開啟路徑（spec: ⏎ 開到目前 pane／⌘⏎ 分割開啟）', () => {
  it('點 chat 卡 → onNewSession(cwd, projectCwd, targetPaneId)', async () => {
    const user = userEvent.setup();
    const props = setup({ targetPaneId: 'pane-3' });
    await user.click(screen.getByTestId('picker-type-chat'));
    expect(props.onNewSession).toHaveBeenCalledWith(
      '/projects/app',
      '/projects/app',
      'pane-3',
      undefined,
    );
  });

  it('點 git 卡 → onOpenToolPane("git", cwd, targetPaneId)', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByTestId('picker-type-git'));
    expect(props.onOpenToolPane).toHaveBeenCalledWith('git', '/projects/app', undefined, undefined);
  });

  it('選定另一個 worktree 後開啟 → cwd 跟著換', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(within(col.worktrees()).getByText('feat-x'));
    await user.click(screen.getByTestId('picker-type-files'));
    expect(props.onOpenToolPane).toHaveBeenCalledWith(
      'files',
      '/projects/app-feat',
      undefined,
      undefined,
    );
  });
});

describe('鍵盤協定（spec: ←→↑↓⏎⌘⏎／快捷字母／⌘1）', () => {
  it('↑↓ 在欄3 移動選取（data-active）、⏎ 啟動選中項', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByLabelText('picker search'));
    // 預設 sel3=0（chat 卡）→ ↓ 到 files
    expect(screen.getByTestId('picker-type-chat')).toHaveAttribute('data-active');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('picker-type-files')).toHaveAttribute('data-active');
    await user.keyboard('{Enter}');
    expect(props.onOpenToolPane).toHaveBeenCalledWith(
      'files',
      '/projects/app',
      undefined,
      undefined,
    );
  });

  it('←→ 換欄、↑↓ 在欄2 換 worktree', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByLabelText('picker search'));
    await user.keyboard('{ArrowLeft}'); // 欄3 → 欄2
    await user.keyboard('{ArrowDown}'); // main → feat-x
    const featBtn = within(col.worktrees()).getByText('feat-x').closest('button');
    expect(featBtn).toHaveAttribute('data-active');
  });

  it('⌘⏎ 啟動帶 split 選項', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByLabelText('picker search'));
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(props.onNewSession).toHaveBeenCalledWith('/projects/app', '/projects/app', undefined, {
      split: true,
    });
  });

  it('快捷字母 G 直接開 git pane（registry hotkey）', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByTestId('picker-type-chat')); // 先聚焦在非 input 元素
    vi.mocked(props.onNewSession).mockClear();
    await user.keyboard('g');
    expect(props.onOpenToolPane).toHaveBeenCalledWith('git', '/projects/app', undefined, undefined);
  });

  it('⌘1 觸發標準工作組', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByLabelText('picker search'));
    await user.keyboard('{Meta>}1{/Meta}');
    expect(props.onOpenCombo).toHaveBeenCalledWith('/projects/app', '/projects/app');
  });
});

describe('搜尋與入口（spec: 頂部搜尋列／新增入口）', () => {
  it('搜尋過濾欄2 worktrees', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText('picker search'), 'feat');
    expect(within(col.worktrees()).getByText('feat-x')).toBeInTheDocument();
    expect(within(col.worktrees()).queryByText('main')).not.toBeInTheDocument();
  });

  it('+ Add project… 呼叫 onAddProject；+ New worktree… 呼叫 onNewWorktree(projectCwd)', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText('+ Add project…'));
    expect(props.onAddProject).toHaveBeenCalled();
    await user.click(screen.getByText('+ New worktree…'));
    expect(props.onNewWorktree).toHaveBeenCalledWith('/projects/app');
  });

  it('Import… 進入 Import 子頁，← 返回三欄', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText(/⬆ Import…/));
    expect(screen.getByText(/Claude JSONL/)).toBeInTheDocument();
    await user.click(screen.getByText(/Claude JSONL/));
    expect(props.onImport).toHaveBeenCalledWith('claude-jsonl', '/projects/app');
    await user.click(screen.getByRole('button', { name: '←' }));
    expect(screen.getByTestId('pane-picker-miller')).toBeInTheDocument();
  });
});
