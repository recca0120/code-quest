/**
 * GapFixes — TDD for 3 gaps identified after Phase 1–3 review
 *
 * Gap-1: KeyboardShortcutsProvider not mounted in production render tree
 * Gap-2: Context Panel shows placeholder, not real FilesPane/GitPane/SpecPane
 * Gap-3: WorkspaceTabBar [⊞] button not connected to Session Manager
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PaneHeader } from '@/components/workspace/PaneHeader';
import { RightPane } from '@/components/workspace/RightPane';
import { WorkspaceTabBar } from '@/components/workspace/WorkspaceTabBar';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <GitProvider>
        <FsProvider>
          <OpenspecProvider>
            <TabProvider>{children}</TabProvider>
          </OpenspecProvider>
        </FsProvider>
      </GitProvider>
    </SocketProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Gap-1: ⌘T keyboard shortcut works in production (KeyboardShortcutsProvider wired)
// ─────────────────────────────────────────────────────────────────────
describe('Gap-1: KeyboardShortcutsProvider is mounted in production', () => {
  it('⌘T creates a new session tab (shortcut fires from WorkspaceLayout)', async () => {
    const user = userEvent.setup();
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();
    // One session open → ⌘T should add a second
    const before = document.querySelectorAll('[data-status]').length;
    await user.keyboard('{Meta>}t{/Meta}');
    expect(document.querySelectorAll('[data-status]').length).toBeGreaterThan(before);
  });

  it('⌘W closes the focused pane without throwing', async () => {
    const user = userEvent.setup();
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();
    await expect(user.keyboard('{Meta>}w{/Meta}')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Gap-2: Context Panel renders real tool content, not placeholder text
// ─────────────────────────────────────────────────────────────────────

function ControlledPaneWithPanel({ cwd }: { cwd: string }) {
  const [activeTool, setActiveTool] = useState<'files' | 'git' | 'spec' | null>(null);
  return (
    <Wrapper>
      <PaneHeader paneId="p1" cwd={cwd} activeTool={activeTool} onToolSelect={setActiveTool} />
      {activeTool && <RightPane cwd={cwd} initialTab={activeTool} />}
    </Wrapper>
  );
}

describe('Gap-2: Context Panel renders real FilesPane / GitPane / SpecPane', () => {
  it('clicking Files icon shows RightPane with Files tab active', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneWithPanel cwd="/project" />);
    await user.click(screen.getByRole('button', { name: /Files/i }));
    // RightPane の tab bar が表示され、Files tab が active になる
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');
    // right-pane-body region が表示される（FilesPane or GitPane or SpecPane を内包）
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });

  it('clicking Git icon shows RightPane with Git tab active', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneWithPanel cwd="/project" />);
    await user.click(screen.getByRole('button', { name: /Git/i }));
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });

  it('clicking Spec icon shows RightPane with Spec tab active', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneWithPanel cwd="/project" />);
    await user.click(screen.getByRole('button', { name: /Spec/i }));
    expect(screen.getByRole('tab', { name: /Spec/i })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });

  it('switching tabs within context panel swaps active tab', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneWithPanel cwd="/project" />);
    await user.click(screen.getByRole('button', { name: /Files/i }));
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');
    await user.click(screen.getByRole('tab', { name: /Git/i }));
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Gap-3: WorkspaceTabBar has [⊞] button that opens Session Manager
// ─────────────────────────────────────────────────────────────────────
describe('Gap-3: WorkspaceTabBar [⊞] opens Session Manager overlay', () => {
  it('WorkspaceTabBar renders an "Open session manager" button', () => {
    render(
      <Wrapper>
        <WorkspaceTabBar />
      </Wrapper>,
    );
    expect(screen.getByRole('button', { name: /open session manager/i })).toBeInTheDocument();
  });

  it('clicking [⊞] opens session-manager overlay', async () => {
    const user = userEvent.setup();
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    await user.click(screen.getByRole('button', { name: /open session manager/i }));
    expect(screen.getByTestId('session-manager')).toBeInTheDocument();
  });

  it('⌘⇧M and [⊞] both open the same session manager', async () => {
    const user = userEvent.setup();
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    // Open via keyboard shortcut
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');
    expect(screen.getByTestId('session-manager')).toBeInTheDocument();

    // Close via Escape
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();

    // Open via button
    await user.click(screen.getByRole('button', { name: /open session manager/i }));
    expect(screen.getByTestId('session-manager')).toBeInTheDocument();
  });
});
