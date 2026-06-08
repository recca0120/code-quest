/**
 * Keyboard Shortcuts K.1–K.5
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions, usePaneState, useTabState } from '@/contexts/TabContext';
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

// K.1: ⌘T opens new session in focused pane's cwd
describe('KeyboardShortcuts (K.1) ⌘T new session', () => {
  it('⌘T creates a new tab', async () => {
    const user = userEvent.setup();
    let tabCount = 0;
    function Probe() {
      const { tabs } = useTabState();
      tabCount = Object.keys(tabs).length;
      return null;
    }
    render(
      <Wrapper>
        <Probe />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}t{/Meta}');
    expect(tabCount).toBe(1);
  });
});

// K.2: ⌘W closes focused pane (no-op if only pane)
describe('KeyboardShortcuts (K.2) ⌘W close pane', () => {
  it('⌘W is no-op when only one pane exists', async () => {
    const user = userEvent.setup();
    let paneType = '';
    function Probe() {
      const { paneRoot } = usePaneState();
      paneType = paneRoot.type;
      return null;
    }
    render(
      <Wrapper>
        <Probe />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}w{/Meta}');
    expect(paneType).toBe('leaf');
  });

  it('⌘W closes focused pane when split', async () => {
    const user = userEvent.setup();
    let paneType = '';
    function Setup() {
      const { paneRoot } = usePaneState();
      const { splitPane, focusPane } = usePaneActions();
      paneType = paneRoot.type;
      return (
        <button
          type="button"
          onClick={() => {
            splitPane('h');
            // focus first leaf after split so ⌘W has a target
            if (paneRoot.type === 'leaf') focusPane(paneRoot.id);
          }}
        >
          split
        </button>
      );
    }
    render(
      <Wrapper>
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: 'split' }));
    expect(paneType).toBe('split');
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}w{/Meta}');
    expect(paneType).toBe('leaf');
  });
});

// K.3: ⌘\ splits focused pane horizontally
describe('KeyboardShortcuts (K.3) ⌘\\ split horizontal', () => {
  it('⌘\\ splits focused pane into two side-by-side panes', async () => {
    const user = userEvent.setup();
    let paneType = '';
    let splitDir: string | undefined;
    function Probe() {
      const { paneRoot } = usePaneState();
      paneType = paneRoot.type;
      if (paneRoot.type === 'split') splitDir = paneRoot.direction;
      return null;
    }
    render(
      <Wrapper>
        <Probe />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}\\{/Meta}');
    expect(paneType).toBe('split');
    expect(splitDir).toBe('h');
  });
});

// K.4: ⌘- splits focused pane vertically
describe('KeyboardShortcuts (K.4) ⌘- split vertical', () => {
  it('⌘- splits focused pane into two stacked panes', async () => {
    const user = userEvent.setup();
    let paneType = '';
    let splitDir: string | undefined;
    function Probe() {
      const { paneRoot } = usePaneState();
      paneType = paneRoot.type;
      if (paneRoot.type === 'split') splitDir = paneRoot.direction;
      return null;
    }
    render(
      <Wrapper>
        <Probe />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );
    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}-{/Meta}');
    expect(paneType).toBe('split');
    expect(splitDir).toBe('v');
  });
});

// K.5: ⌘⌥← focuses adjacent pane
describe('KeyboardShortcuts (K.5) ⌘⌥← focus adjacent pane', () => {
  it('⌘⌥← focuses the other pane after splitting', async () => {
    const user = userEvent.setup();
    const capturedIds: (string | null)[] = [];

    function Setup() {
      const { focusedPaneId } = usePaneState();
      const { splitPane } = usePaneActions();
      capturedIds.push(focusedPaneId);
      return (
        <button type="button" onClick={() => splitPane('h')}>
          split
        </button>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));
    const focusedAfterSplit = capturedIds[capturedIds.length - 1];

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Alt>}{ArrowLeft}{/Alt}{/Meta}');

    const focusedAfterNav = capturedIds[capturedIds.length - 1];
    expect(focusedAfterNav).not.toBe(focusedAfterSplit);
  });
});
