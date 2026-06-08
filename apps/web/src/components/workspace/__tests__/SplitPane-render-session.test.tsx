/**
 * Group 9.2: SplitPane renderLeaf prop — session content rendering integration
 * Tests that SplitPane can render session content via renderLeaf prop
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SplitPane } from '@/components/workspace/SplitPane';
import { SocketProvider } from '@/contexts/SocketContext';
import type { PaneNode } from '@/contexts/TabContext';
import { TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

// 9.2a: renderLeaf renders session content
describe('SplitPane renderLeaf (9.2a)', () => {
  it('renderLeaf receives pane node and renders content', async () => {
    const user = userEvent.setup();

    function renderLeaf(node: PaneNode) {
      if (node.type !== 'leaf') return null;
      const sid = node.content.type === 'session' ? node.content.sessionId : null;
      return <div data-testid={`session-content-${sid ?? 'empty'}`}>session:{sid ?? 'none'}</div>;
    }

    function Test() {
      const { setSessionInPane } = usePaneActions();
      const { paneRoot } = usePaneState();
      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : null;
      return (
        <>
          <button type="button" onClick={() => leafId && setSessionInPane(leafId, 'ch-abc')}>
            set
          </button>
          <SplitPane renderLeaf={renderLeaf} />
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );

    expect(screen.getByTestId('session-content-empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByTestId('session-content-ch-abc')).toBeInTheDocument();
  });
});

// 9.2b: forceMount — sessions not in pane stay mounted
describe('SplitPane forceMount (9.2b)', () => {
  it('renderLeaf is called for all leaf panes regardless of zoom', async () => {
    const user = userEvent.setup();
    const renderCalls: string[] = [];

    function renderLeaf(node: PaneNode) {
      if (node.type !== 'leaf') return null;
      const sid = node.content.type === 'session' ? node.content.sessionId : null;
      renderCalls.push(node.id);
      return <div data-testid={`leaf-${node.id}`}>{sid ?? 'empty'}</div>;
    }

    function Test() {
      const { splitPane, zoomPane } = usePaneActions();
      const { paneRoot } = usePaneState();
      const firstLeafId = paneRoot.type === 'leaf' ? paneRoot.id : null;

      return (
        <>
          <button type="button" onClick={() => splitPane('h')}>
            split
          </button>
          <button type="button" onClick={() => firstLeafId && zoomPane(firstLeafId)}>
            zoom
          </button>
          <SplitPane renderLeaf={renderLeaf} />
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'split' }));
    await user.click(screen.getByRole('button', { name: 'zoom' }));

    // Both leaves should still be rendered (forceMount), one is hidden via CSS
    const allLeaves = screen.getAllByTestId(/^leaf-/);
    expect(allLeaves).toHaveLength(2);
  });
});
