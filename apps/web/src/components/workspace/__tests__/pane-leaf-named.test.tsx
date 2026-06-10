import type { SessionStateSummary } from '@code-quest/schemas';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type PaneContent,
  type PaneNode,
  TabProvider,
  usePaneActions,
  usePaneState,
} from '@/contexts/TabContext';
import { PaneTree } from '../PaneTree.tsx';

// Heavy views are stubbed — these tests verify the PaneLeaf shell + dispatch, not view internals
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
  useGitState: () => ({
    listing: {
      '/projects/app': [{ path: '/projects/app/feat', branch: 'feat-x', name: 'feat' }],
    },
  }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({
    activeProjectCwd: '/projects/app',
    projects: [{ cwd: '/projects/app', name: 'app' }],
  }),
}));

let probeActions: ReturnType<typeof usePaneActions> | null = null;
let probeState: ReturnType<typeof usePaneState> | null = null;

function Probe() {
  probeActions = usePaneActions();
  probeState = usePaneState();
  return null;
}

function firstLeafIdOf(node: PaneNode): string {
  if (node.type === 'leaf') return node.id;
  return firstLeafIdOf(node.first);
}

function Harness({ sessions }: { sessions?: SessionStateSummary[] }) {
  return (
    <TabProvider sessions={sessions}>
      <Probe />
      <PaneTree />
    </TabProvider>
  );
}

function setContent(content: PaneContent) {
  const paneId = firstLeafIdOf(probeState!.paneRoot);
  act(() => probeActions!.setContentInPane(paneId, content));
  return paneId;
}

describe('PaneLeaf — unified Pane shell for every content type (3.2)', () => {
  it.each<[string, PaneContent, string]>([
    ['git', { type: 'git', target: { kind: 'fixed', cwd: '/projects/app/feat' } }, 'git-view'],
    [
      'files',
      { type: 'files', target: { kind: 'fixed', cwd: '/projects/app/feat' } },
      'files-view',
    ],
    [
      'openspec',
      { type: 'openspec', target: { kind: 'fixed', cwd: '/projects/app/feat' } },
      'spec-view',
    ],
    ['worktrees', { type: 'worktrees' }, 'worktrees-view'],
  ])('%s pane renders one toolbar and its body', (_label, content, bodyTestId) => {
    render(<Harness />);
    setContent(content);

    expect(screen.getAllByTestId('pane-header')).toHaveLength(1);
    expect(screen.getByTestId(bodyTestId)).toBeInTheDocument();
  });

  it('tool panes contribute a WorktreeSwitcher into the toolbar slot', () => {
    render(<Harness />);
    setContent({ type: 'git', target: { kind: 'fixed', cwd: '/projects/app/feat' } });

    expect(screen.getByLabelText('worktree switcher')).toBeInTheDocument();
  });

  it('worktrees pane has standard toolbar but no WorktreeSwitcher', () => {
    render(<Harness />);
    setContent({ type: 'worktrees' });

    expect(screen.getByTestId('pane-header')).toBeInTheDocument();
    expect(screen.queryByLabelText('worktree switcher')).not.toBeInTheDocument();
  });
});

describe('SessionPane — render-time liveness (3.4)', () => {
  it('renders TabContent when session meta exists', () => {
    const { rerender } = render(<Harness />);
    rerender(
      <Harness
        sessions={[
          {
            channelId: 'ch-1',
            state: 'idle',
            cwd: '/projects/app/feat',
            projectRoot: '/projects/app',
          },
        ]}
      />,
    );
    const paneId = firstLeafIdOf(probeState!.paneRoot);
    act(() => probeActions!.setSessionInPane(paneId, 'ch-1', '/projects/app/feat'));

    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-pane')).not.toBeInTheDocument();
  });

  it('renders EmptyPane with restore hint when meta is absent but cwd is known', () => {
    render(<Harness />);
    const paneId = firstLeafIdOf(probeState!.paneRoot);
    act(() => probeActions!.setSessionInPane(paneId, 'ch-dead', '/projects/app/feat'));

    const empty = screen.getByTestId('empty-pane');
    expect(empty).toBeInTheDocument();
    // hint resolves branch/project from the worktree listing at render time
    expect(empty.textContent).toContain('app');
    expect(empty.textContent).toContain('feat-x');
  });

  it('renders plain EmptyPane when no binding at all', () => {
    render(<Harness />);
    // default leaf is { type:'session', sessionId:null, cwd:null }
    expect(screen.getByTestId('empty-pane')).toBeInTheDocument();
    expect(screen.getByText('Empty pane')).toBeInTheDocument();
  });
});

describe('SessionPane — self-heal (3.5)', () => {
  const SESSION: SessionStateSummary = {
    channelId: 'ch-1',
    state: 'idle',
    cwd: '/projects/app/feat',
    projectRoot: '/projects/app',
  };

  it('switches EmptyPane → TabContent when session meta arrives late, and back on close', () => {
    const { rerender } = render(<Harness sessions={[]} />);
    const paneId = firstLeafIdOf(probeState!.paneRoot);
    act(() => probeActions!.setSessionInPane(paneId, 'ch-1', '/projects/app/feat'));

    // sessions not arrived yet → empty pane with hint
    expect(screen.getByTestId('empty-pane')).toBeInTheDocument();

    // sessions arrive → same leaf self-heals into TabContent
    rerender(<Harness sessions={[SESSION]} />);
    expect(screen.queryByTestId('empty-pane')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();

    // session dies → meta removed → same leaf degrades back to EmptyPane
    rerender(<Harness sessions={[]} />);
    expect(screen.queryByTestId('chat-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-pane')).toBeInTheDocument();
  });
});
