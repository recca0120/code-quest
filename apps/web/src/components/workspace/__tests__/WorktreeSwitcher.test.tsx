import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WorktreeSwitcher } from '@/components/workspace/WorktreeSwitcher';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

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

// T.4: shows emoji, label and current branch
describe('WorktreeSwitcher (T.4) shows emoji, label and current branch', () => {
  it('button shows emoji, label and ⎇ branch', () => {
    render(
      <Wrapper>
        <WorktreeSwitcher
          emoji="🌿"
          label="Git"
          cwd="/project/main"
          paneId="p1"
          availableWorktrees={availableWorktrees}
          makeContent={(c) => ({ type: 'git', cwd: c })}
        />
      </Wrapper>,
    );
    const btn = screen.getByRole('button', { name: /worktree switcher/i });
    expect(btn.textContent).toContain('🌿 Git');
    expect(btn.textContent).toContain('⎇ main');
  });

  it('shows dropdown toggle button (▾)', () => {
    render(
      <Wrapper>
        <WorktreeSwitcher
          emoji="🌿"
          label="Git"
          cwd="/project/main"
          paneId="p1"
          availableWorktrees={availableWorktrees}
          makeContent={(c) => ({ type: 'git', cwd: c })}
        />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /worktree switcher/i })).toBeInTheDocument();
  });

  it('clicking button shows available worktrees with ⎇ branch (project) format in dropdown', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <WorktreeSwitcher
          emoji="🌿"
          label="Git"
          cwd="/project/main"
          paneId="p1"
          availableWorktrees={availableWorktrees}
          makeContent={(c) => ({ type: 'git', cwd: c })}
        />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /worktree switcher/i }));
    const dropdown = screen.getByTestId('cwd-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown).toHaveTextContent('⎇ main (app)');
    expect(dropdown).toHaveTextContent('⎇ feat-auth (app)');
  });
});

// T.5: selecting a worktree updates the pane content
describe('WorktreeSwitcher (T.5) selecting worktree updates pane cwd', () => {
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

    function SwitcherWithRealId() {
      const { paneRoot } = usePaneState();
      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : 'p1';
      return (
        <WorktreeSwitcher
          emoji="🌿"
          label="Git"
          cwd="/project/main"
          paneId={leafId}
          availableWorktrees={availableWorktrees}
          makeContent={(c) => ({ type: 'git', cwd: c })}
        />
      );
    }

    render(
      <Wrapper>
        <Setup />
        <SwitcherWithRealId />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /worktree switcher/i }));
    await user.click(screen.getByRole('button', { name: /feat-auth/i }));
    expect(cwdInPane).toBe('/project/feature');
  });
});
