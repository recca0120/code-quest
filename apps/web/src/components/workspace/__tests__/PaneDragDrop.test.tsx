/**
 * Pane Drag & Drop D.1–D.2
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Pane } from '@/components/workspace/Pane';
import { PaneTree } from '@/components/workspace/PaneTree';
import { GitProvider } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <ProjectProvider>
        <GitProvider>
          <TabProvider>{children}</TabProvider>
        </GitProvider>
      </ProjectProvider>
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
      const { splitPane } = usePaneActions();

      return (
        <button type="button" onClick={() => splitPane('h')}>
          setup
        </button>
      );
    }

    let paneIds = { leftId: '', rightId: '' };
    const lastPaneIds = () => paneIds;

    function TwoPaneHeaders() {
      const { paneRoot } = usePaneState();
      const { swapPane } = usePaneActions();

      if (paneRoot.type !== 'split') return null;
      const left = paneRoot.first;
      const right = paneRoot.second;
      if (!left || !right) return null;
      paneIds = { leftId: left.id, rightId: right.id };

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

    // drop 在右 header → 右側的 onSwap 必須收到「被拖來的左側」paneId
    // （只驗 length 的話，swap 方向錯置也會綠）
    const probe = lastPaneIds();
    expect(swappedPairs).toEqual([[probe.rightId, probe.leftId]]);
  });
});

// P4: 五落點（tmux-workspace-ui；spec: 拖曳重排五落點）
describe('PaneDragDrop 五落點（D.5）', () => {
  function Setup() {
    const { splitPane } = usePaneActions();
    return (
      <button type="button" onClick={() => splitPane('h')}>
        setup
      </button>
    );
  }

  it('拖曳 hover 在 leaf 上浮出五落點；drop 右落點 → 該 leaf h-split、source 移到右半', async () => {
    render(
      <Wrapper>
        <TabProvider>
          <Setup />
          <PaneTree />
        </TabProvider>
      </Wrapper>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'setup' }));
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(2);
    const sourceId = leaves[0]!.dataset.paneId!;
    const targetId = leaves[1]!.dataset.paneId!;

    // dragenter 浮出落點（只在 hover 的 leaf 上）
    fireEvent.dragEnter(leaves[1]!);
    const zones = screen.getByTestId('drop-zones');
    for (const key of ['top', 'bottom', 'left', 'right', 'center']) {
      expect(screen.getByTestId(`drop-zone-${key}`)).toBeInTheDocument();
    }
    expect(zones.closest('[data-pane-id]')?.getAttribute('data-pane-id')).toBe(targetId);

    // drop 在右落點 → target 變 h-split：target 左、source 右
    fireEvent.drop(screen.getByTestId('drop-zone-right'), {
      dataTransfer: { getData: () => sourceId },
    });
    const after = screen.getAllByTestId('split-pane-leaf');
    expect(after).toHaveLength(2);
    // 重排後順序：target 在前、source 在後（source 移到 target 右側）
    expect(after[0]!.dataset.paneId).toBe(targetId);
    expect(after[1]!.dataset.paneId).toBe(sourceId);
    // 落點收掉
    expect(screen.queryByTestId('drop-zones')).not.toBeInTheDocument();
  });

  it('drop 中央落點 → 置換（既有 swap 行為，結構不變）', async () => {
    render(
      <Wrapper>
        <TabProvider>
          <Setup />
          <PaneTree />
        </TabProvider>
      </Wrapper>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'setup' }));
    const leaves = screen.getAllByTestId('split-pane-leaf');
    const sourceId = leaves[0]!.dataset.paneId!;

    fireEvent.dragEnter(leaves[1]!);
    fireEvent.drop(screen.getByTestId('drop-zone-center'), {
      dataTransfer: { getData: () => sourceId },
    });
    // swap：leaf id 不變（content 互換）、結構不變
    const after = screen.getAllByTestId('split-pane-leaf');
    expect(after.map((l) => l.dataset.paneId)).toEqual(leaves.map((l) => l.dataset.paneId));
  });
});
