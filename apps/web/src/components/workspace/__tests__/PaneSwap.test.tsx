/**
 * Pane Swap S.1–S.2
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

function leafContent(node: ReturnType<typeof usePaneState>['paneRoot']): string {
  if (node.type === 'leaf') {
    return node.content.type === 'session'
      ? (node.content.sessionId ?? 'empty')
      : node.content.type;
  }
  return '';
}

// S.1: swapPane action swaps content of two leaf panes
describe('PaneSwap (S.1) swapPane action', () => {
  it('swaps content of two sibling leaf panes', async () => {
    const user = userEvent.setup();
    let leftContent = '';
    let rightContent = '';

    function Setup() {
      const { paneRoot } = usePaneState();
      const { splitPane, setSessionInPane, swapPane } = usePaneActions();

      if (paneRoot.type === 'split') {
        leftContent = leafContent(paneRoot.first);
        rightContent = leafContent(paneRoot.second);
      }

      return (
        <>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button
            type="button"
            onClick={() => {
              if (paneRoot.type === 'split') {
                setSessionInPane(paneRoot.first.id, 'sess-A', null);
                setSessionInPane(paneRoot.second.id, 'sess-B', null);
              }
            }}
          >
            fill
          </button>
          <button
            type="button"
            onClick={() => {
              if (paneRoot.type === 'split') {
                swapPane(paneRoot.first.id, paneRoot.second.id);
              }
            }}
          >
            swap
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <Setup />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));
    await user.click(screen.getByRole('button', { name: 'fill' }));
    expect(leftContent).toBe('sess-A');
    expect(rightContent).toBe('sess-B');

    await user.click(screen.getByRole('button', { name: 'swap' }));
    expect(leftContent).toBe('sess-B');
    expect(rightContent).toBe('sess-A');
  });
});

// S.2: ⌘⇧→ swaps focused pane with right sibling
describe('PaneSwap (S.2) ⌘⇧→ swaps focused pane with right sibling', () => {
  it('⌘⇧→ swaps content of focused pane with its right sibling', async () => {
    const user = userEvent.setup();
    let leftContent = '';
    let rightContent = '';

    function Setup() {
      const { paneRoot } = usePaneState();
      const { splitPane, setSessionInPane, focusPane } = usePaneActions();

      if (paneRoot.type === 'split') {
        leftContent = leafContent(paneRoot.first);
        rightContent = leafContent(paneRoot.second);
      }

      return (
        <button
          type="button"
          onClick={() => {
            if (paneRoot.type === 'leaf') {
              splitPane('h');
            } else if (paneRoot.type === 'split') {
              setSessionInPane(paneRoot.first.id, 'sess-A', null);
              setSessionInPane(paneRoot.second.id, 'sess-B', null);
              focusPane(paneRoot.first.id);
            }
          }}
        >
          next
        </button>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <button type="button" data-testid="focus-target" aria-label="focus target" />
      </Wrapper>,
    );

    // click twice: first split, then fill+focus
    await user.click(screen.getByRole('button', { name: 'next' }));
    await user.click(screen.getByRole('button', { name: 'next' }));
    expect(leftContent).toBe('sess-A');
    expect(rightContent).toBe('sess-B');

    await user.click(screen.getByTestId('focus-target'));
    await user.keyboard('{Meta>}{Shift>}{ArrowRight}{/Shift}{/Meta}');

    expect(leftContent).toBe('sess-B');
    expect(rightContent).toBe('sess-A');
  });
});
