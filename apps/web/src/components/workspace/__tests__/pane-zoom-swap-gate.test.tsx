/**
 * Phase D bug fixes (pane-tree-named-components §D):
 * - 4.1/4.2 zoom/mobile solo rendering at PaneSplit（修「zoom 不放大」佔位空洞）
 * - 4.4 toolbar DnD swap（修死碼）
 * - 4.6 純 tool-pane layout 不被空狀態 gate 吃掉
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaneTree } from '@/components/workspace/PaneTree';
import { TabContainer } from '@/components/workspace/TabContainer';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { type PaneNode, TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';

vi.mock('@/contexts/channel', () => ({
  ChannelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../chat/ChatView.tsx', () => ({
  ChatView: () => <div data-testid="chat-view" />,
}));
vi.mock('../../git/GitView.tsx', () => ({
  GitView: () => <div data-testid="git-view" />,
}));
vi.mock('../../files/FilesView.tsx', () => ({
  FilesView: () => <div data-testid="files-view" />,
}));
vi.mock('../../spec/SpecView.tsx', () => ({
  SpecView: () => <div data-testid="spec-view" />,
}));
vi.mock('../WorktreesPane.tsx', () => ({
  WorktreesPane: () => <div data-testid="worktrees-view" />,
}));
vi.mock('@/contexts/GitContext', () => ({
  useGitState: () => ({ listing: {} }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({ activeProjectCwd: '/p', projects: [{ cwd: '/p', name: 'p' }] }),
}));
vi.mock('@/contexts/SessionContext', () => ({
  useSession: () => ({ closeSession: vi.fn() }),
}));

function mockMobile(isMobile: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: isMobile ? query.includes('max-width') : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => vi.restoreAllMocks());

function actHelper(fn: () => void) {
  act(fn);
}

let probeState: ReturnType<typeof usePaneState> | null = null;
let probeActions: ReturnType<typeof usePaneActions> | null = null;

function Probe() {
  probeState = usePaneState();
  probeActions = usePaneActions();
  return null;
}

function leavesOf(node: PaneNode): Extract<PaneNode, { type: 'leaf' }>[] {
  if (node.type === 'leaf') return [node];
  return [...leavesOf(node.first), ...leavesOf(node.second)];
}

function renderTree() {
  const utils = render(
    <TabProvider>
      <Probe />
      <PaneTree />
    </TabProvider>,
  );
  return { ...utils, state: () => probeState!, actions: () => probeActions! };
}

describe('zoom solo rendering (4.1) — zoomed pane fills the root', () => {
  it('zoom 後不渲染 percentage wrapper 與 divider，另一個 leaf 不在 DOM', () => {
    const { container, state, actions } = renderTree();
    const firstId = leavesOf(state().paneRoot)[0]!.id;

    fireEvent.click(screen.getByTestId('split-pane-leaf')); // focus
    actHelper(() => actions().splitPane('h'));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    const otherId = leavesOf(state().paneRoot).find((l) => l.id !== firstId)!.id;

    actHelper(() => actions().zoomPane(firstId));

    // zoomed leaf 是唯一渲染的 leaf，佔滿 root（無 split wrapper、無 divider、無 % style）
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.dataset.paneId).toBe(firstId);
    expect(container.querySelector(`[data-pane-id="${otherId}"]`)).toBeNull();
    expect(screen.queryByTestId('split-pane-split')).toBeNull();
    expect(screen.queryByTestId('pane-divider')).toBeNull();

    // un-zoom 後恢復雙 pane
    actHelper(() => actions().zoomPane(null));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    expect(screen.getByTestId('pane-divider')).toBeInTheDocument();
  });
});

describe('mobile solo rendering (4.2) — focused pane fills the area', () => {
  it('mobile 時只渲染 focused leaf，無 divider', () => {
    mockMobile(true);
    const { state, actions } = renderTree();
    const firstId = leavesOf(state().paneRoot)[0]!.id;

    actHelper(() => actions().splitPane('h'));
    actHelper(() => actions().focusPane(firstId));

    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.dataset.paneId).toBe(firstId);
    expect(screen.queryByTestId('pane-divider')).toBeNull();
  });
});

describe('toolbar DnD swap (4.4)', () => {
  it('拖 pane A 的 header 丟到 pane B 的 header — 兩 leaf content 互換', () => {
    const { state, actions } = renderTree();
    const firstId = leavesOf(state().paneRoot)[0]!.id;

    actHelper(() => actions().splitPane('h'));
    const secondId = leavesOf(state().paneRoot).find((l) => l.id !== firstId)!.id;
    actHelper(() =>
      actions().setContentInPane(firstId, { type: 'git', target: { kind: 'fixed', cwd: '/a' } }),
    );
    actHelper(() =>
      actions().setContentInPane(secondId, {
        type: 'files',
        target: { kind: 'fixed', cwd: '/b' },
      }),
    );

    const headers = screen.getAllByTestId('pane-header');
    expect(headers).toHaveLength(2);

    const dataTransfer = {
      data: new Map<string, string>(),
      setData(type: string, value: string) {
        this.data.set(type, value);
      },
      getData(type: string) {
        return this.data.get(type) ?? '';
      },
      effectAllowed: '',
    };
    fireEvent.dragStart(headers[0]!, { dataTransfer });
    fireEvent.drop(headers[1]!, { dataTransfer });

    const leaves = leavesOf(state().paneRoot);
    expect(leaves.find((l) => l.id === firstId)!.content.type).toBe('files');
    expect(leaves.find((l) => l.id === secondId)!.content.type).toBe('git');
  });
});

describe('handleCreateTab fallback — focused tool pane must not swallow the session', () => {
  function Wrapper({ pendingCwd }: { pendingCwd: string | null }) {
    return (
      <NavigationProvider>
        <TabProvider>
          <Probe />
          <TabContainer pendingNewSessionCwd={pendingCwd} onSessionCreated={() => {}} />
        </TabProvider>
      </NavigationProvider>
    );
  }

  it('creates a visible session even when the focused pane is a worktrees pane', () => {
    const { rerender } = render(<Wrapper pendingCwd={null} />);

    const leafId = leavesOf(probeState!.paneRoot)[0]!.id;
    actHelper(() => probeActions!.setContentInPane(leafId, { type: 'worktrees' }));
    actHelper(() => probeActions!.focusPane(leafId));

    rerender(<Wrapper pendingCwd="/repo/feat" />);

    // session must land in a pane (split), not be silently dropped
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    expect(screen.getAllByTestId('pane-header').length).toBe(2);
  });
});

describe('empty-state gate (4.6) — 純 tool-pane layout 不被吃掉', () => {
  function renderContainer() {
    return render(
      <NavigationProvider>
        <TabProvider>
          <Probe />
          <TabContainer />
        </TabProvider>
      </NavigationProvider>,
    );
  }

  it('default 空狀態（單一 empty session leaf、零 session tab）顯示 No open sessions', () => {
    renderContainer();
    expect(screen.getByText('No open sessions')).toBeInTheDocument();
  });

  it('git pane 存在但零 session tab — pane 照常渲染，不顯示全域 EmptyState', () => {
    renderContainer();
    const firstId = leavesOf(probeState!.paneRoot)[0]!.id;
    actHelper(() =>
      probeActions!.setContentInPane(firstId, {
        type: 'git',
        target: { kind: 'fixed', cwd: '/repo' },
      }),
    );

    expect(screen.queryByText('No open sessions')).toBeNull();
    expect(screen.getByTestId('git-view')).toBeInTheDocument();
  });
});
