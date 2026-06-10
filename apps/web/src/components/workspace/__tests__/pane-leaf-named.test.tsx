/**
 * PaneLeaf shell + dispatch（pane-tree 3.2 / 3.4 / 3.5 / worktree-centric 1.5）。
 *
 * 慣例（fake-summoner-client skill）：只 fake process 邊界——
 * git/fs/openspec 用 summoner priming、projects 走 container ProjectStore →
 * 真 ProjectProvider（projects:list）、git listing 走真 GitContext action →
 * 真 handler → FakeGit。GitView/FilesView/SpecView/WorktreesPane 都是真元件；
 * session 生死由 pushServerEvent('session:states'/'session:dead') 經真
 * SessionProvider 流入 TabProvider（不再用 rerender props 餵 sessions）。
 * 唯二 stub：ChannelProvider/ChatView（深層 chat 管線，shell 結構測試慣例）。
 * Probe 直呼 actions 僅作 arrange（setContentInPane / setSessionInPane /
 * setActiveProject / git list）。
 */
import { type ProjectStore, TYPES } from '@code-quest/server/test';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useGitActions } from '@/contexts/GitContext';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import {
  firstLeafId,
  type PaneContent,
  TabProvider,
  usePaneActions,
  usePaneState,
} from '@/contexts/TabContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { PaneTree } from '../PaneTree.tsx';

// 深層 chat 管線 stub —— 這些測試驗 PaneLeaf shell + dispatch，不驗 chat 內部
vi.mock('@/contexts/channel', () => ({
  ChannelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../chat/ChatView.tsx', () => ({
  ChatView: ({ projectName }: { projectName?: string }) => (
    <div data-testid="chat-view">{projectName}</div>
  ),
}));

const PROJECT_APP = '/projects/app';
const PROJECT_OTHER = '/projects/other';
const FEAT_CWD = '/projects/app/feat';
const OTHER_MAIN_CWD = '/projects/other/main';

let probeActions: ReturnType<typeof usePaneActions> | null = null;
let probeState: ReturnType<typeof usePaneState> | null = null;
let probeGitActions: ReturnType<typeof useGitActions> | null = null;
let probeProjectState: ReturnType<typeof useProjectState> | null = null;
let probeProjectActions: ReturnType<typeof useProjectActions> | null = null;

function Probe() {
  probeActions = usePaneActions();
  probeState = usePaneState();
  probeGitActions = useGitActions();
  probeProjectState = useProjectState();
  probeProjectActions = useProjectActions();
  return null;
}

/** 鏡射 Workspace 的接線：TabProvider 的 sessions 來自真 SessionProvider。 */
function TabProviderBridge({ children }: { children: ReactNode }) {
  const { sessions } = useSession();
  const { activeProjectCwd } = useProjectState();
  return (
    <TabProvider sessions={sessions} cwd={activeProjectCwd ?? undefined}>
      {children}
    </TabProvider>
  );
}

async function setup() {
  const { summoner, container, Wrapper } = createTestWrapper();

  // process 邊界 priming：git（app 是 repo、有 feat worktree）
  // 註：FakeGit 是單 repo（getProjectRoot/listWorktrees 全域），無法表達
  // 「other 另有自己的 worktrees」，故只 prime / list app 的 listing。
  const git = summoner.git()!;
  git.markAsRepo(PROJECT_APP);
  git.setProjectRoot(PROJECT_APP);
  git.addWorktree({ path: FEAT_CWD, branch: 'feat-x', name: 'feat' });

  // process 邊界 priming：fs roots（FilesView 的 cwd probe 需在 allowed roots 內）
  const fs = summoner.filesystem();
  fs.setRoots(['/projects']);
  fs.addDirectory('/projects', ['app', 'other']);
  fs.addDirectory(PROJECT_APP, ['feat']);
  fs.addDirectory(FEAT_CWD, []);

  // DB：兩個 project（name 取 basename → app / other），真 provider 經 projects:list 載入
  const projectStore = container.get<ProjectStore>(TYPES.ProjectStore);
  await projectStore.upsert(PROJECT_APP);
  await projectStore.upsert(PROJECT_OTHER);

  render(
    <Wrapper>
      <TabProviderBridge>
        <Probe />
        <PaneTree />
      </TabProviderBridge>
    </Wrapper>,
  );

  await act(async () => {});
  await waitFor(() => expect(probeProjectState!.projects).toHaveLength(2));

  // arrange：active project = app；app 的 worktree listing 走真 pipeline
  // （GitContext.list → git:worktree:list handler → FakeGit）
  act(() => probeProjectActions!.setActiveProject(PROJECT_APP));
  await act(async () => {
    await probeGitActions!.list(PROJECT_APP);
  });

  return { summoner, container, claude: summoner.claude() };
}

function setContent(content: PaneContent) {
  const paneId = firstLeafId(probeState!.paneRoot)!;
  act(() => probeActions!.setContentInPane(paneId, content));
  return paneId;
}

function setSession(channelId: string, cwd: string) {
  const paneId = firstLeafId(probeState!.paneRoot)!;
  act(() => probeActions!.setSessionInPane(paneId, channelId, cwd));
  return paneId;
}

describe('PaneLeaf — unified Pane shell for every content type (3.2)', () => {
  it.each<[string, PaneContent, () => Promise<HTMLElement>]>([
    [
      'git',
      { type: 'git', target: { kind: 'fixed', cwd: FEAT_CWD } },
      () => screen.findByLabelText('git-pane'),
    ],
    [
      'files',
      { type: 'files', target: { kind: 'fixed', cwd: FEAT_CWD } },
      () => screen.findByLabelText('files-pane'),
    ],
    [
      'openspec',
      { type: 'openspec', target: { kind: 'fixed', cwd: FEAT_CWD } },
      () => screen.findByLabelText('spec-pane'),
    ],
    ['worktrees', { type: 'worktrees' }, () => screen.findByTestId('worktrees-pane')],
  ])('%s pane renders one toolbar and its real body', async (_label, content, findBody) => {
    await setup();
    setContent(content);

    expect(screen.getAllByTestId('pane-header')).toHaveLength(1);
    expect(await findBody()).toBeInTheDocument();
  });

  it('tool panes contribute a WorktreeSwitcher into the toolbar slot', async () => {
    const { summoner } = await setup();
    setContent({ type: 'git', target: { kind: 'fixed', cwd: FEAT_CWD } });

    // ① UI：switcher 存在且用真 listing 反查 branch label（非裸 cwd）
    const switcher = screen.getByLabelText('worktree switcher');
    expect(switcher).toBeInTheDocument();
    expect(switcher.textContent).toContain('⎇ feat-x');

    // ② client → server：真 GitView 對該 cwd 走真 git:status pipeline
    await screen.findByLabelText('git-pane');
    expect(summoner.sentEvents('git:status')).toContainEqual({ cwd: FEAT_CWD });
  });

  it('worktrees pane has standard toolbar but no WorktreeSwitcher', async () => {
    await setup();
    setContent({ type: 'worktrees' });

    expect(screen.getByTestId('pane-header')).toBeInTheDocument();
    expect(screen.queryByLabelText('worktree switcher')).not.toBeInTheDocument();
  });
});

describe('SessionPane — render-time liveness (3.4)', () => {
  it('renders TabContent when session meta exists', async () => {
    const { claude } = await setup();
    await act(async () => {
      claude.pushServerEvent('session:states', {
        sessions: [{ channelId: 'ch-1', state: 'idle', cwd: FEAT_CWD, projectRoot: PROJECT_APP }],
      });
    });
    setSession('ch-1', FEAT_CWD);

    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-pane')).not.toBeInTheDocument();
  });

  it('renders EmptyPane with restore hint when meta is absent but cwd is known', async () => {
    await setup();
    setSession('ch-dead', FEAT_CWD);

    const empty = screen.getByTestId('empty-pane');
    expect(empty).toBeInTheDocument();
    // hint 在 render 時從真 worktree listing 反查 branch/project
    expect(empty.textContent).toContain('app');
    expect(empty.textContent).toContain('feat-x');
  });

  it('renders plain EmptyPane when no binding at all', async () => {
    await setup();
    // default leaf is { type:'session', sessionId:null, cwd:null }
    expect(screen.getByTestId('empty-pane')).toBeInTheDocument();
    expect(screen.getByText('Empty pane')).toBeInTheDocument();
  });
});

describe('SessionPane — self-heal (3.5)', () => {
  it('switches EmptyPane → TabContent when session meta arrives late, and back on death', async () => {
    const { claude } = await setup();
    setSession('ch-1', FEAT_CWD);

    // session:states 還沒進來 → empty pane（帶 hint）
    expect(screen.getByTestId('empty-pane')).toBeInTheDocument();

    // server 廣播 session:states → 真 SessionProvider → TabProvider diff → 同一 leaf 自癒成 TabContent
    await act(async () => {
      claude.pushServerEvent('session:states', {
        sessions: [{ channelId: 'ch-1', state: 'idle', cwd: FEAT_CWD, projectRoot: PROJECT_APP }],
      });
    });
    expect(screen.queryByTestId('empty-pane')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();

    // session 死亡走真死亡路徑（session:dead）→ meta 移除 → 同一 leaf 退回 EmptyPane
    await act(async () => {
      claude.pushServerEvent('session:dead', { channelId: 'ch-1' });
    });
    expect(screen.queryByTestId('chat-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-pane')).toBeInTheDocument();
  });
});

describe('SessionPane — per-session project name（worktree-centric 1.5）', () => {
  it('cross-project session shows ITS project name, not the active project', async () => {
    const { claude } = await setup(); // setup 已把 active project 設為 app
    await act(async () => {
      claude.pushServerEvent('session:states', {
        sessions: [
          { channelId: 'ch-b', state: 'idle', cwd: OTHER_MAIN_CWD, projectRoot: PROJECT_OTHER },
        ],
      });
    });
    setSession('ch-b', OTHER_MAIN_CWD);

    // activeProject 是 app，但這個 session 屬於 other
    expect(screen.getByTestId('chat-view').textContent).toBe('other');
  });
});
