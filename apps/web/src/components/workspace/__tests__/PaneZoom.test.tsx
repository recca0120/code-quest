/**
 * Group 5: Pane Zoom keyboard shortcut tests
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';
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

// 5.1: ⌘⇧Z sets zoomedPaneId = focusedPaneId; already zoomed clears it
describe('KeyboardShortcutsProvider zoom (5.1) keyboard shortcut', () => {
  it('Cmd+Shift+Z zooms focused pane', async () => {
    const user = userEvent.setup();
    let zoomedId: string | null = 'not-set';
    let focusedId: string | null = null;

    function Probe() {
      const { focusedPaneId, zoomedPaneId, paneRoot } = usePaneState();
      const { focusPane } = usePaneActions();
      zoomedId = zoomedPaneId;
      focusedId = focusedPaneId;

      if (paneRoot.type === 'leaf' && !focusedPaneId) {
        // auto-focus on first render
        focusPane(paneRoot.id);
      }

      return <button type="button" data-testid="probe" tabIndex={0} />;
    }

    render(
      <Wrapper>
        <Probe />
      </Wrapper>,
    );

    // Focus the element so keyboard events are captured
    const probe = screen.getByTestId('probe');
    probe.focus();

    expect(zoomedId).toBeNull();
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
    expect(zoomedId).not.toBeNull();
    expect(zoomedId).toBe(focusedId);
  });

  it('Cmd+Shift+Z when already zoomed clears zoom', async () => {
    const user = userEvent.setup();
    let zoomedId: string | null = 'not-set';

    function Probe() {
      const { zoomedPaneId, paneRoot } = usePaneState();
      const { focusPane } = usePaneActions();
      zoomedId = zoomedPaneId;

      if (paneRoot.type === 'leaf') {
        focusPane(paneRoot.id);
      }

      return <button type="button" data-testid="probe2" tabIndex={0} />;
    }

    render(
      <Wrapper>
        <Probe />
      </Wrapper>,
    );
    const probe = screen.getByTestId('probe2');
    probe.focus();

    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
    expect(zoomedId).not.toBeNull();
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
    expect(zoomedId).toBeNull();
  });
});
