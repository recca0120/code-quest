import { render, screen } from '@testing-library/react';
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
  '/projects/other': [{ path: '/projects/other', branch: 'main', name: 'main' }],
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  sessions,
  projects,
  allWorktrees,
  activeProjectCwd: '/projects/app',
};

const pastSessions = [
  {
    id: 'past-1',
    channelId: 'ch-past-1',
    title: 'Fix login bug',
    cwd: '/projects/app',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'past-2',
    channelId: 'ch-past-2',
    title: 'Add dashboard',
    cwd: '/projects/app-feat',
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
];

// ── open/close ──────────────────────────────────────────────────────────────
describe('PanePicker — open/close', () => {
  it('renders when open is true', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getByRole('dialog', { name: /open in pane/i })).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<PanePicker {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ── flat list structure ──────────────────────────────────────────────────────
describe('PanePicker (B) — flat list structure', () => {
  it('shows all project names', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(screen.getByText('other')).toBeInTheDocument();
  });

  it('shows all worktree branches', () => {
    render(<PanePicker {...defaultProps} />);
    const branches = screen.getAllByText(/⎇/);
    const texts = branches.map((el) => el.textContent ?? '');
    expect(texts.some((t) => t.includes('main'))).toBe(true);
    expect(texts.some((t) => t.includes('feat-x'))).toBe(true);
  });

  it('worktree with active session shows data-has-session=true', () => {
    render(<PanePicker {...defaultProps} />);
    expect(document.querySelector('[data-has-session="true"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-has-session="false"]').length).toBeGreaterThan(0);
  });

  it('[+ Add project] calls onAddProject', async () => {
    const user = userEvent.setup();
    const onAddProject = vi.fn();
    render(<PanePicker {...defaultProps} onAddProject={onAddProject} />);
    await user.click(screen.getByRole('button', { name: /\+ Add project/i }));
    expect(onAddProject).toHaveBeenCalled();
  });
});

// ── active sessions ──────────────────────────────────────────────────────────
describe('PanePicker (B) — active sessions', () => {
  it('shows active sessions under their worktree', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getByTestId('modal-session-item-ch-1')).toBeInTheDocument();
    expect(screen.getByTestId('modal-session-item-ch-2')).toBeInTheDocument();
  });

  it('session shows branch + status', () => {
    render(<PanePicker {...defaultProps} />);
    const item = screen.getByTestId('modal-session-item-ch-1');
    expect(item).toHaveTextContent('⎇ main');
    expect(item).toHaveTextContent('Task A');
  });

  it('session with paneLabel shows ← label', () => {
    const sessionsWithLabel = [
      {
        channelId: 'ch-1',
        title: 'Task A',
        status: 'idle' as const,
        branch: 'main',
        cwd: '/projects/app',
        paneLabel: 'Left pane',
      },
    ];
    render(<PanePicker {...defaultProps} sessions={sessionsWithLabel} />);
    expect(screen.getByText('← Left pane')).toBeInTheDocument();
  });

  it('[Show here] calls onShowHere with channelId and targetPaneId', async () => {
    const user = userEvent.setup();
    const onShowHere = vi.fn();
    render(<PanePicker {...defaultProps} onShowHere={onShowHere} targetPaneId="pane-3" />);
    await user.click(screen.getAllByRole('button', { name: /show here/i })[0]!);
    expect(onShowHere).toHaveBeenCalledWith('ch-1', 'pane-3');
  });
});

// ── VS: view 切換基礎 ─────────────────────────────────────────────────────────
describe('PanePicker (VS) — view switching', () => {
  it('VS.1 default view shows worktree list (main view)', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^←$/i })).not.toBeInTheDocument();
  });

  it('VS.2 non-main view shows [←] back button', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    expect(screen.getByRole('button', { name: /^←$/ })).toBeInTheDocument();
  });

  it('VS.3 clicking [←] returns to main view', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    expect(screen.queryByText('app')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^←$/ }));
    expect(screen.getByText('app')).toBeInTheDocument();
  });
});

// ── AI: AI picker view ────────────────────────────────────────────────────────
describe('PanePicker (AI) — AI picker view', () => {
  it('AI.1 each worktree has [💬 AI ▶] button', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getAllByRole('button', { name: /💬 AI/i }).length).toBe(3);
  });

  it('AI.2 clicking [💬 AI ▶] switches to AI picker view with branch title', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    expect(screen.getByText(/AI.*main/i)).toBeInTheDocument();
    expect(screen.queryByText('app')).not.toBeInTheDocument();
  });

  // 單一 AI provider：直接顯示 actions（折疊兩層）
  it('AI.3 single provider — AI picker shows actions directly, no provider button', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    // 不顯示 [Claude ▶] provider 選擇按鈕
    expect(screen.queryByRole('button', { name: /claude ▶/i })).not.toBeInTheDocument();
    // 直接顯示 actions
    expect(screen.getByRole('button', { name: /new session/i })).toBeInTheDocument();
  });

  it('AI.4 single provider — [+ New Session] calls onNewSession', async () => {
    const user = userEvent.setup();
    const onNewSession = vi.fn();
    render(<PanePicker {...defaultProps} onNewSession={onNewSession} targetPaneId="pane-1" />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /new session/i }));
    expect(onNewSession).toHaveBeenCalledWith('/projects/app', '/projects/app', 'pane-1');
  });

  it('AI.5 AI picker shows [⟳ Resume ▶] only if worktree has past sessions', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('AI.6 AI picker shows [⬆ Import ▶] always', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
  });

  it('AI.7 main view has NO Resume, Import, or New Session buttons', () => {
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    expect(screen.queryByRole('button', { name: /new session/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import/i })).not.toBeInTheDocument();
  });
});

// ── RV: Resume view ───────────────────────────────────────────────────────────
describe('PanePicker (RV) — Resume view', () => {
  it('RV.1 past sessions hidden in main view', () => {
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();
  });

  it('RV.2 clicking [⟳ Resume ▶] in AI picker switches to Resume view', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /resume/i }));
    expect(screen.getByText(/resume.*main/i)).toBeInTheDocument();
    expect(screen.queryByText(/AI.*main/i)).not.toBeInTheDocument();
  });

  it('RV.3 Resume view lists past sessions with title and relative time', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /resume/i }));
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText(/2h ago/)).toBeInTheDocument();
  });

  it('RV.3 Resume view only shows sessions for that worktree', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /resume/i }));
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.queryByText('Add dashboard')).not.toBeInTheDocument();
  });

  it('RV.4 clicking [Resume] in Resume view calls onResume(sessionId)', async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} onResume={onResume} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /resume/i }));
    await user.click(screen.getByRole('button', { name: /^resume$/i }));
    expect(onResume).toHaveBeenCalledWith('past-1');
  });

  it('RV.5 [←] from Resume view goes back to AI picker', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} pastSessions={pastSessions} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /resume/i }));
    await user.click(screen.getByRole('button', { name: /^←$/ }));
    expect(screen.getByText(/AI.*main/i)).toBeInTheDocument();
  });
});

// ── IV: Import view ───────────────────────────────────────────────────────────
describe('PanePicker (IV) — Import view', () => {
  it('IV.2 clicking [⬆ Import ▶] in AI picker switches to Import view', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /import/i }));
    expect(screen.getByText(/import.*main/i)).toBeInTheDocument();
    expect(screen.queryByText(/AI.*main/i)).not.toBeInTheDocument();
  });

  it('IV.3 Import view shows [Claude JSONL] option', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /import/i }));
    expect(screen.getByRole('button', { name: /claude jsonl/i })).toBeInTheDocument();
  });

  it('IV.4 clicking [Claude JSONL] calls onImport with format and worktreePath', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<PanePicker {...defaultProps} onImport={onImport} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /import/i }));
    await user.click(screen.getByRole('button', { name: /claude jsonl/i }));
    expect(onImport).toHaveBeenCalledWith('claude-jsonl', '/projects/app');
  });

  it('IV.5 [←] from Import view goes back to AI picker', async () => {
    const user = userEvent.setup();
    render(<PanePicker {...defaultProps} />);
    await user.click(screen.getAllByRole('button', { name: /💬 AI/i })[0]!);
    await user.click(screen.getByRole('button', { name: /import/i }));
    await user.click(screen.getByRole('button', { name: /^←$/ }));
    expect(screen.getByText(/AI.*main/i)).toBeInTheDocument();
  });
});

// ── one-click tool panes ──────────────────────────────────────────────────────
describe('PanePicker (B) — one-click tool panes', () => {
  it('each worktree has Git, Files, Spec buttons', () => {
    render(<PanePicker {...defaultProps} />);
    expect(document.querySelectorAll('[data-tool="git"]').length).toBe(3);
    expect(document.querySelectorAll('[data-tool="files"]').length).toBe(3);
    expect(document.querySelectorAll('[data-tool="openspec"]').length).toBe(3);
  });

  it('[Git] calls onOpenToolPane with worktree path', async () => {
    const user = userEvent.setup();
    const onOpenToolPane = vi.fn();
    render(<PanePicker {...defaultProps} onOpenToolPane={onOpenToolPane} targetPaneId="pane-2" />);
    await user.click(document.querySelectorAll('[data-tool="git"]')[0] as HTMLElement);
    expect(onOpenToolPane).toHaveBeenCalledWith('git', '/projects/app', 'pane-2');
  });

  it('[+ New worktree] calls onNewWorktree with projectCwd', async () => {
    const user = userEvent.setup();
    const onNewWorktree = vi.fn();
    render(<PanePicker {...defaultProps} onNewWorktree={onNewWorktree} />);
    await user.click(screen.getAllByRole('button', { name: /\+ New worktree/i })[0]!);
    expect(onNewWorktree).toHaveBeenCalledWith('/projects/app');
  });
});

// ── design alignment ─────────────────────────────────────────────────────────
describe('PanePicker — design alignment', () => {
  it('dialog title is "Open in pane"', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.getByRole('dialog', { name: /open in pane/i })).toBeInTheDocument();
  });

  it('session without pane shows no ← label', () => {
    render(<PanePicker {...defaultProps} />);
    expect(screen.queryByText(/←/)).not.toBeInTheDocument();
  });
});
