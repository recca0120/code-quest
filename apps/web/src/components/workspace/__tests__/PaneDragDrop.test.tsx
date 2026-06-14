/**
 * Pane Drag & Drop D.1/D.3/D.5
 *
 * 置換（swap）唯一入口＝中央落點 drop-zone-center（決策 14：pane header 不再兼任
 * drop target，header 只當 drag source）。
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaneTree } from '@/components/workspace/PaneTree';
import { Toolbar as PaneToolbar } from '@/components/workspace/panes/Pane';
import { GitProvider } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { type PaneNode, TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';
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
        <PaneToolbar paneId="p1" />
      </Wrapper>,
    );
    expect(screen.getByTestId('pane-header')).toHaveAttribute('draggable', 'true');
  });

  it('dragstart sets data-dragging attribute', () => {
    render(
      <Wrapper>
        <PaneToolbar paneId="p1" />
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    fireEvent.dragStart(header);
    expect(header).toHaveAttribute('data-dragging');
  });

  it('dragend removes data-dragging attribute', () => {
    render(
      <Wrapper>
        <PaneToolbar paneId="p1" />
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    fireEvent.dragStart(header);
    expect(header).toHaveAttribute('data-dragging');
    fireEvent.dragEnd(header);
    expect(header).not.toHaveAttribute('data-dragging');
  });
});

// D.3: ghost 縮影（handoff §7）——dragstart 以 pane clone 設 setDragImage
describe('PaneDragDrop (D.3) ghost drag image', () => {
  it('dragstart clone 最近的 [data-pane-id] 當 ghost（-1.5°/0.92/offscreen）；dragend 移除節點', () => {
    render(
      <Wrapper>
        <div data-pane-id="p1">
          <PaneToolbar paneId="p1" />
        </div>
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    const setDragImage = vi.fn();
    fireEvent.dragStart(header, {
      dataTransfer: { setData: vi.fn(), setDragImage, effectAllowed: '' },
    });

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const ghost = setDragImage.mock.calls[0]![0] as HTMLElement;
    // clone 自 pane 殼、插入 DOM（setDragImage 來源需在 DOM 內）但置 offscreen
    expect(document.body.contains(ghost)).toBe(true);
    expect(ghost.getAttribute('data-pane-id')).toBe('p1');
    expect(ghost.style.position).toBe('fixed');
    expect(ghost.style.top).toBe('-10000px');
    expect(ghost.style.transform).toBe('rotate(-1.5deg)');
    expect(ghost.style.opacity).toBe('0.92');
    expect(ghost.style.borderRadius).toBe('var(--pane-radius)');
    // 半尺寸 cap 330×170
    expect(Number.parseFloat(ghost.style.width)).toBeLessThanOrEqual(330);
    expect(Number.parseFloat(ghost.style.height)).toBeLessThanOrEqual(170);

    fireEvent.dragEnd(header);
    expect(document.body.contains(ghost)).toBe(false);
  });

  it('setDragImage 不可用（jsdom 無此方法／happy-dom 擲 Not implemented）→ 安全略過、不留 ghost 節點', () => {
    render(
      <Wrapper>
        <div data-pane-id="p1">
          <PaneToolbar paneId="p1" />
        </div>
      </Wrapper>,
    );
    const header = screen.getByTestId('pane-header');
    const before = document.body.childElementCount;
    // 不帶 setDragImage stub → RTL 以真 DataTransfer 建事件，happy-dom 原生 setDragImage 擲錯
    fireEvent.dragStart(header, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    expect(header).toHaveAttribute('data-dragging');
    expect(document.body.childElementCount).toBe(before);
  });
});

/** 先序走訪取 leaf content——swap 驗證用（leaf id 不變、content 互換）。 */
function leafContents(node: PaneNode): Record<string, PaneNode & { type: 'leaf' }> {
  if (node.type === 'leaf') return { [node.id]: node };
  return { ...leafContents(node.first), ...leafContents(node.second) };
}

/** 兩 leaf 塞不同 git cwd（/a、/b）——content 互換才有可觀察差異。 */
function primeDistinctContents(
  actions: ReturnType<typeof usePaneActions>,
  sourceId: string,
  targetId: string,
) {
  act(() => {
    actions.setContentInPane(sourceId, { type: 'git', target: { kind: 'fixed', cwd: '/a' } });
  });
  act(() => {
    actions.setContentInPane(targetId, { type: 'git', target: { kind: 'fixed', cwd: '/b' } });
  });
}

// 決策 14：header 不再是 drop target——置換統一走中央落點（D.5 center 覆蓋）
describe('PaneDragDrop pane header is not a drop target (決策 14)', () => {
  it('drop 在另一個 header 上不觸發置換（content 不互換）', async () => {
    let state: ReturnType<typeof usePaneState> | null = null;
    let actions: ReturnType<typeof usePaneActions> | null = null;
    function Probe() {
      state = usePaneState();
      actions = usePaneActions();
      return null;
    }
    function Setup() {
      const { splitPane } = usePaneActions();
      return (
        <button type="button" onClick={() => splitPane('h')}>
          setup
        </button>
      );
    }

    render(
      <Wrapper>
        <TabProvider>
          <Setup />
          <Probe />
          <PaneTree />
        </TabProvider>
      </Wrapper>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'setup' }));
    const leaves = screen.getAllByTestId('split-pane-leaf');
    const sourceId = leaves[0]!.dataset.paneId!;
    const targetId = leaves[1]!.dataset.paneId!;
    primeDistinctContents(actions!, sourceId, targetId);

    const headers = screen.getAllByTestId('pane-header');
    const dt = new DataTransfer();
    fireEvent.dragStart(headers[0]!, { dataTransfer: dt });
    fireEvent.drop(headers[1]!, { dataTransfer: dt });

    // header 不是落點：content 留在原位
    const contents = leafContents(state!.paneRoot);
    expect(contents[sourceId]!.content).toMatchObject({ target: { cwd: '/a' } });
    expect(contents[targetId]!.content).toMatchObject({ target: { cwd: '/b' } });
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

  it('落點命中態：dragenter 切 data-hot、dragleave 移除（drag 中 :hover 無效，§7）', async () => {
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

    fireEvent.dragEnter(leaves[1]!);
    const zone = screen.getByTestId('drop-zone-right');
    expect(zone).not.toHaveAttribute('data-hot');

    fireEvent.dragEnter(zone);
    expect(zone).toHaveAttribute('data-hot');

    // 移到另一個落點：新落點 hot、舊落點解除
    const center = screen.getByTestId('drop-zone-center');
    fireEvent.dragEnter(center);
    fireEvent.dragLeave(zone);
    expect(center).toHaveAttribute('data-hot');
    expect(zone).not.toHaveAttribute('data-hot');

    fireEvent.dragLeave(center);
    expect(center).not.toHaveAttribute('data-hot');
  });

  it('drop 中央落點 → 置換（leaf id 不變、content 互換、結構不變）', async () => {
    let state: ReturnType<typeof usePaneState> | null = null;
    let actions: ReturnType<typeof usePaneActions> | null = null;
    function Probe() {
      state = usePaneState();
      actions = usePaneActions();
      return null;
    }
    render(
      <Wrapper>
        <TabProvider>
          <Setup />
          <Probe />
          <PaneTree />
        </TabProvider>
      </Wrapper>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'setup' }));
    const leaves = screen.getAllByTestId('split-pane-leaf');
    const sourceId = leaves[0]!.dataset.paneId!;
    const targetId = leaves[1]!.dataset.paneId!;
    primeDistinctContents(actions!, sourceId, targetId);

    fireEvent.dragEnter(screen.getAllByTestId('split-pane-leaf')[1]!);
    fireEvent.drop(screen.getByTestId('drop-zone-center'), {
      dataTransfer: { getData: () => sourceId },
    });
    // swap：leaf id 不變（content 互換）、結構不變
    const after = screen.getAllByTestId('split-pane-leaf');
    expect(after.map((l) => l.dataset.paneId)).toEqual([sourceId, targetId]);
    const contents = leafContents(state!.paneRoot);
    expect(contents[sourceId]!.content).toMatchObject({ target: { cwd: '/b' } });
    expect(contents[targetId]!.content).toMatchObject({ target: { cwd: '/a' } });
  });
});
