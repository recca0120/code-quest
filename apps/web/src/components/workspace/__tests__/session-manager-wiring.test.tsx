/**
 * SessionManager 接線（worktree-centric entry-wiring 3.1-3.4）：
 * 按鈕不再是 no-op；一個 worktree 列出全部 sessions；+ New session 恆常可用。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { SessionManager } from '@/components/workspace/SessionManager';
import { TabProvider } from '@/contexts/TabContext';

vi.mock('@/contexts/GitContext', () => ({
  useGitState: () => ({
    listing: {
      '/p': [
        { path: '/p', branch: 'main', name: 'p' },
        { path: '/p/feat', branch: 'feat/x', name: 'feat' },
      ],
    },
  }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({
    activeProjectCwd: '/p',
    projects: [{ cwd: '/p', name: 'p' }],
  }),
}));

const TWO_SESSIONS_SAME_WORKTREE = {
  tabs: {
    s1: { tabStatus: 'idle' as const, mode: 'resume' as const, cwd: '/p/feat', title: 'one' },
    s2: { tabStatus: 'idle' as const, mode: 'resume' as const, cwd: '/p/feat', title: 'two' },
  },
  activeTabId: 's1',
};

describe('SessionManager Projects 區 — 一對多（3.3/3.4）', () => {
  it('同 worktree 兩個 sessions 都列出，且 + New session 恆常可按', async () => {
    const onNewSession = vi.fn();
    render(
      <TabProvider initialState={TWO_SESSIONS_SAME_WORKTREE}>
        <SessionManager onClose={() => {}} onNewSession={onNewSession} />
      </TabProvider>,
    );

    // 兩個 session 連結（Projects 區）
    expect(screen.getAllByTestId('session-manager-item-s1').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('session-manager-item-s2').length).toBeGreaterThan(0);

    // + New session 對已有 session 的 worktree 仍可用，帶 (cwd, projectCwd)
    const buttons = screen.getAllByTestId('new-session-btn');
    expect(buttons.length).toBeGreaterThan(0);
    const user = userEvent.setup();
    await user.click(buttons[buttons.length - 1]!);
    expect(onNewSession).toHaveBeenCalledWith(expect.any(String), '/p');
  });
});

describe('KeyboardShortcutsProvider 轉交 handlers（3.1/3.2）', () => {
  it('⌘⇧M 開啟後點 + New session — handler 被呼叫且 manager 關閉', async () => {
    const onNewSession = vi.fn();
    render(
      <TabProvider initialState={TWO_SESSIONS_SAME_WORKTREE}>
        <KeyboardShortcutsProvider onNewSession={onNewSession}>
          <div data-testid="content" />
        </KeyboardShortcutsProvider>
      </TabProvider>,
    );

    const user = userEvent.setup();
    await user.keyboard('{Meta>}{Shift>}M{/Shift}{/Meta}');
    expect(screen.getByTestId('session-manager')).toBeInTheDocument();

    await user.click(screen.getAllByTestId('new-session-btn')[0]!);
    expect(onNewSession).toHaveBeenCalledWith('/p', '/p');
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();
  });
});
