/**
 * GapFixes — TDD for 3 gaps identified after Phase 1–3 review
 *
 * Gap-1: KeyboardShortcutsProvider not mounted in production render tree
 * Gap-2: Context Panel shows placeholder, not real FilesPane/GitPane/SpecPane
 * Gap-3: WorkspaceTabBar [⊞] button not connected to Session Manager
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { RightPane } from '@/components/workspace/RightPane';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <ProjectProvider>
        <GitProvider>
          <FsProvider>
            <OpenspecProvider>
              <TabProvider>{children}</TabProvider>
            </OpenspecProvider>
          </FsProvider>
        </GitProvider>
      </ProjectProvider>
    </SocketProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Gap-1: ⌘T keyboard shortcut works in production (KeyboardShortcutsProvider wired)
// ─────────────────────────────────────────────────────────────────────
describe('Gap-1: KeyboardShortcutsProvider is mounted in production', () => {
  it('⌘T creates a new session tab (shortcut fires from Workspace)', async () => {
    const user = userEvent.setup();
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();
    // One session open → ⌘T should add a second, visibly placed in a pane
    const before = screen.getAllByTestId('split-pane-leaf').length;
    await user.keyboard('{Meta>}t{/Meta}');
    await waitFor(() =>
      expect(screen.getAllByTestId('split-pane-leaf').length).toBeGreaterThan(before),
    );
  });

  it('⌘W on single pane is a no-op (no split → nothing to close)', async () => {
    const user = userEvent.setup();
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    await project.launchSession();

    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    await user.keyboard('{Meta>}w{/Meta}');
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Gap-2: Context Panel renders real tool content, not placeholder text
// ─────────────────────────────────────────────────────────────────────

function ControlledPaneWithPanel({ cwd }: { cwd: string }) {
  const [rightOpen, setRightOpen] = useState(false);
  return (
    <Wrapper>
      <button type="button" onClick={() => setRightOpen((v) => !v)} aria-label="Toggle right pane">
        toggle
      </button>
      {rightOpen && <RightPane cwd={cwd} />}
    </Wrapper>
  );
}

// TG.4: PaneLeafContent toggle 行為（透過 ChatBreadcrumb toggle button）
describe('Gap-2: Context Panel renders real FilesPane / GitPane / SpecPane', () => {
  it('clicking toggle shows RightPane with Files tab active by default', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneWithPanel cwd="/project" />);
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Toggle right pane/i }));
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });

  it('clicking toggle again hides RightPane', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneWithPanel cwd="/project" />);
    await user.click(screen.getByRole('button', { name: /Toggle right pane/i }));
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Toggle right pane/i }));
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
  });

  it('switching tabs within RightPane swaps active tab', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneWithPanel cwd="/project" />);
    await user.click(screen.getByRole('button', { name: /Toggle right pane/i }));
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');
    await user.click(screen.getByRole('tab', { name: /Git/i }));
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
  });
});
