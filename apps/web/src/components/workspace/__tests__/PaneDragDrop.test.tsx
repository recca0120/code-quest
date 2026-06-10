/**
 * Pane Drag & Drop D.1–D.2
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Pane } from '@/components/workspace/Pane';
import { SocketProvider } from '@/contexts/SocketContext';
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

// D.1: PaneHeader shows data-dragging when being dragged
describe('PaneDragDrop (D.1) pane header drag indicator', () => {
  it('header has draggable attribute', () => {
    render(
      <Wrapper>
        <Pane.Toolbar paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-header')).toHaveAttribute('draggable', 'true');
  });

  it('dragstart sets data-dragging attribute', () => {
    render(
      <Wrapper>
        <Pane.Toolbar paneId="p1" />
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    fireEvent.dragStart(header);
    expect(header).toHaveAttribute('data-dragging');
  });

  it('dragend removes data-dragging attribute', () => {
    render(
      <Wrapper>
        <Pane.Toolbar paneId="p1" />
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    fireEvent.dragStart(header);
    expect(header).toHaveAttribute('data-dragging');
    fireEvent.dragEnd(header);
    expect(header).not.toHaveAttribute('data-dragging');
  });
});

// D.2: dropping on another header swaps pane contents
describe('PaneDragDrop (D.2) drop swaps pane contents', () => {
  it('drop on target pane header calls swapPane', async () => {
    const swappedPairs: [string, string][] = [];

    function Setup() {
      const { paneRoot } = usePaneState();
      const { splitPane, setSessionInPane } = usePaneActions();

      return (
        <button
          type="button"
          onClick={() => {
            splitPane('h');
            if (paneRoot.type === 'split') {
              setSessionInPane(paneRoot.first.id, 'sess-L');
              setSessionInPane(paneRoot.second.id, 'sess-R');
            }
          }}
        >
          setup
        </button>
      );
    }

    function TwoPaneHeaders() {
      const { paneRoot } = usePaneState();
      const { swapPane } = usePaneActions();

      if (paneRoot.type !== 'split') return null;
      const left = paneRoot.first;
      const right = paneRoot.second;
      if (!left || !right) return null;

      return (
        <>
          <Pane.Toolbar
            paneId={left.id}
            onSwap={(targetId) => {
              swappedPairs.push([left.id, targetId]);
              swapPane(left.id, targetId);
            }}
          />
          <Pane.Toolbar
            paneId={right.id}
            onSwap={(targetId) => {
              swappedPairs.push([right.id, targetId]);
              swapPane(right.id, targetId);
            }}
          />
        </>
      );
    }

    render(
      <Wrapper>
        <Setup />
        <TwoPaneHeaders />
      </Wrapper>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'setup' }));

    const headers = screen.getAllByTestId('pane-header');
    expect(headers).toHaveLength(2);

    // Simulate drag from left header to right header using dataTransfer
    const leftHeader = headers[0]!;
    const rightHeader = headers[1]!;
    const dt = new DataTransfer();

    fireEvent.dragStart(leftHeader, { dataTransfer: dt });
    // dt.getData returns the paneId set by dragStart handler
    fireEvent.drop(rightHeader, { dataTransfer: dt });

    expect(swappedPairs).toHaveLength(1);
  });
});
