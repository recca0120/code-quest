import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AppInitProvider } from '@/contexts/AppInitContext';
import { NavigationProvider, useNavigationActions } from '@/contexts/NavigationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, useTabState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Probe() {
  const { tabs, activeTabId } = useTabState();
  const cwd = activeTabId ? tabs[activeTabId]?.cwd : null;
  return (
    <>
      <span role="status" aria-label="tab-count">
        {Object.keys(tabs).length}
      </span>
      <span role="status" aria-label="active-cwd">
        {cwd ?? 'null'}
      </span>
    </>
  );
}

function Trigger({
  projectCwd,
  worktreeCwd,
  forceNew,
}: {
  projectCwd: string;
  worktreeCwd: string;
  forceNew?: boolean;
}) {
  const { requestOpenWorktree } = useNavigationActions();
  return (
    <button type="button" onClick={() => requestOpenWorktree(projectCwd, worktreeCwd, forceNew)}>
      open
    </button>
  );
}

function Wrapper({ projectCwd, children }: { projectCwd: string; children: ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <AppInitProvider>
        <SessionProvider>
          <ProjectProvider>
            <NavigationProvider>
              <TabProvider cwd={projectCwd}>{children}</TabProvider>
            </NavigationProvider>
          </ProjectProvider>
        </SessionProvider>
      </AppInitProvider>
    </SocketProvider>
  );
}

describe('TabProvider: pendingOpenWorktree consumption', () => {
  it('intent with matching projectCwd + no existing tab → creates tab (mockup openWt)', async () => {
    render(
      <Wrapper projectCwd="/repo">
        <Probe />
        <Trigger projectCwd="/repo" worktreeCwd="/repo/.claude/worktrees/feat-x" />
      </Wrapper>,
    );
    expect(screen.getByRole('status', { name: 'tab-count' }).textContent).toBe('0');

    await act(async () => {
      screen.getByRole('button', { name: 'open' }).click();
    });

    expect(screen.getByRole('status', { name: 'tab-count' }).textContent).toBe('1');
    expect(screen.getByRole('status', { name: 'active-cwd' }).textContent).toBe(
      '/repo/.claude/worktrees/feat-x',
    );
  });

  it('forceNew=true: each click creates a new tab', async () => {
    render(
      <Wrapper projectCwd="/repo">
        <Probe />
        <Trigger projectCwd="/repo" worktreeCwd="/repo/.claude/worktrees/feat-x" forceNew />
      </Wrapper>,
    );
    expect(screen.getByRole('status', { name: 'tab-count' }).textContent).toBe('0');

    await act(async () => {
      screen.getByRole('button', { name: 'open' }).click();
    });
    expect(screen.getByRole('status', { name: 'tab-count' }).textContent).toBe('1');

    await act(async () => {
      screen.getByRole('button', { name: 'open' }).click();
    });
    expect(screen.getByRole('status', { name: 'tab-count' }).textContent).toBe('2');
  });

  it('global TabProvider handles worktree intents for any projectCwd', async () => {
    // Design Decision 4: single global TabProvider handles all projects.
    // No projectCwd guard — cross-project intents are processed normally.
    render(
      <Wrapper projectCwd="/repo">
        <Probe />
        <Trigger projectCwd="/other" worktreeCwd="/other/.claude/worktrees/x" />
      </Wrapper>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'open' }).click();
    });

    expect(screen.getByRole('status', { name: 'tab-count' }).textContent).toBe('1');
    expect(screen.getByRole('status', { name: 'active-cwd' }).textContent).toBe(
      '/other/.claude/worktrees/x',
    );
  });
});
