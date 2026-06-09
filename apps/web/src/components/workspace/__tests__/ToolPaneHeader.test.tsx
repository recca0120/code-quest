/**
 * Tool Pane Header T.4–T.5
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GitPane } from '@/components/workspace/ToolPanes';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

vi.mock('@/contexts/GitContext', () => ({
  useGitActions: () => ({ refetchGitStatus: vi.fn() }),
  useGitStatus: () => undefined,
}));
vi.mock('@/contexts/FsContext', () => ({
  useFsActions: () => ({ browse: vi.fn().mockResolvedValue({ directories: [], files: [] }) }),
}));
vi.mock('@/contexts/OpenspecContext', () => ({
  useOpenspecList: () => undefined,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

const availableWorktrees = [
  { path: '/project/main', branch: 'main', name: 'main', projectName: 'app' },
  { path: '/project/feature', branch: 'feat-auth', name: 'feature', projectName: 'app' },
];

// T.4: Tool Pane header shows emoji + branch switcher (⎇ branch)
describe('ToolPaneHeader (T.4) header shows emoji and branch switcher', () => {
  it('GitPane shows 🌿 Git title', () => {
    render(
      <Wrapper>
        <GitPane cwd="/project/main" availableWorktrees={availableWorktrees} paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('tool-pane-header')).toHaveTextContent('🌿 Git');
  });

  it('shows current branch with ⎇ prefix in header', () => {
    render(
      <Wrapper>
        <GitPane cwd="/project/main" availableWorktrees={availableWorktrees} paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('tool-pane-header')).toHaveTextContent('⎇ main');
  });

  it('shows dropdown toggle button (▾)', () => {
    render(
      <Wrapper>
        <GitPane cwd="/project/main" availableWorktrees={availableWorktrees} paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /worktree switcher/i })).toBeInTheDocument();
  });

  it('clicking ▾ shows available worktrees with ⎇ branch (project) format in dropdown', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <GitPane cwd="/project/main" availableWorktrees={availableWorktrees} paneId="p1" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /worktree switcher/i }));
    const dropdown = screen.getByTestId('cwd-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveTextContent('⎇ main (app)');
    expect(dropdown).toHaveTextContent('⎇ feat-auth (app)');
  });
});

// T.5: selecting a worktree in the dropdown updates the pane content
describe('ToolPaneHeader (T.5) worktree switcher updates pane cwd', () => {
  it('clicking a worktree option updates the pane content cwd', async () => {
    const user = userEvent.setup();
    let cwdInPane = '';

    function Setup() {
      const { paneRoot } = usePaneState();
      if (paneRoot.type === 'leaf' && paneRoot.content.type === 'git') {
        cwdInPane = paneRoot.content.cwd;
      }
      return null;
    }

    function GitPaneWithRealId() {
      const { paneRoot } = usePaneState();
      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : 'p1';
      return (
        <GitPane cwd="/project/main" availableWorktrees={availableWorktrees} paneId={leafId} />
      );
    }

    render(
      <Wrapper>
        <Setup />
        <GitPaneWithRealId />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /worktree switcher/i }));
    await user.click(screen.getByRole('button', { name: /feat-auth/i }));
    expect(cwdInPane).toBe('/project/feature');
  });
});
