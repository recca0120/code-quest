/**
 * Session Manager Overlay O.1–O.3
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneState, useTabActions } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>
        <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
      </TabProvider>
    </SocketProvider>
  );
}

// O.1: ⌘⇧M opens Session Manager overlay
describe('SessionManager (O.1) ⌘⇧M opens overlay', () => {
  it('⌘⇧M shows session manager overlay', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');

    expect(screen.getByTestId('session-manager')).toBeInTheDocument();
  });

  it('pressing ⌘⇧M again closes the overlay', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');
    expect(screen.getByTestId('session-manager')).toBeInTheDocument();

    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();
  });

  it('Escape closes the overlay', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');
    expect(screen.getByTestId('session-manager')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();
  });
});

// O.2: Overlay lists all sessions
describe('SessionManager (O.2) overlay lists sessions', () => {
  it('shows all sessions with their names', async () => {
    const user = userEvent.setup();

    function Setup() {
      const { addTab } = useTabActions();
      return (
        <button
          type="button"
          onClick={() => {
            addTab('sess-1', '/project');
            addTab('sess-2', '/project');
          }}
        >
          add sessions
        </button>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'add sessions' }));
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');

    const manager = screen.getByTestId('session-manager');
    expect(manager).toBeInTheDocument();
    // Sessions should be listed
    const items = manager.querySelectorAll('[data-testid^="session-manager-item"]');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});

// O.3: Clicking session in overlay fills focused pane
describe('SessionManager (O.3) clicking session fills pane and closes overlay', () => {
  it('clicking a session assigns it to the focused pane', async () => {
    const user = userEvent.setup();
    let leafSessionId: string | null = null;

    function Probe() {
      const { paneRoot } = usePaneState();
      if (paneRoot.type === 'leaf' && paneRoot.content.type === 'session') {
        leafSessionId = paneRoot.content.sessionId ?? null;
      }
      return null;
    }

    function Setup() {
      const { addTab } = useTabActions();
      return (
        <button type="button" onClick={() => addTab('sess-target', '/project')}>
          add session
        </button>
      );
    }

    render(
      <Wrapper>
        <Probe />
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'add session' }));
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}m{/Shift}{/Meta}');

    const item = screen.getByTestId('session-manager-item-sess-target');
    await user.click(item);

    expect(leafSessionId).toBe('sess-target');
    expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();
  });
});
