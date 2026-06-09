/**
 * Context Panel E.1–E.5 + Git/Files content (E.6–E.10)
 */
import { createFakeServer } from '@code-quest/server/test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  ContextPanelFiles,
  ContextPanelGit,
  ContextPanelSpec,
} from '@/components/workspace/ContextPanel';
import { PaneHeader } from '@/components/workspace/PaneHeader';
import { RightPane } from '@/components/workspace/RightPane';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner, FakeSummoner } from '@/test/fake-summoner';

// ── Wrappers ──

function Wrapper({ children }: { children: ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <GitProvider>
        <FsProvider>
          <TabProvider>{children}</TabProvider>
        </FsProvider>
      </GitProvider>
    </SocketProvider>
  );
}

function makeGitEnv() {
  const server = createFakeServer();
  const priming = new FakeSummoner(server);
  function GitWrapper({ children }: { children: ReactNode }) {
    const ref = useRef<FakeSummoner | null>(null);
    if (!ref.current) ref.current = new FakeSummoner(server);
    return (
      <SocketProvider socket={ref.current.socket}>
        <GitProvider>
          <FsProvider>
            <TabProvider>{children}</TabProvider>
          </FsProvider>
        </GitProvider>
      </SocketProvider>
    );
  }
  return { GitWrapper, priming };
}

function makeFsEnv() {
  const server = createFakeServer();
  const priming = new FakeSummoner(server);
  function FsWrapper({ children }: { children: ReactNode }) {
    const ref = useRef<FakeSummoner | null>(null);
    if (!ref.current) ref.current = new FakeSummoner(server);
    return (
      <SocketProvider socket={ref.current.socket}>
        <GitProvider>
          <FsProvider>
            <TabProvider>{children}</TabProvider>
          </FsProvider>
        </GitProvider>
      </SocketProvider>
    );
  }
  return { FsWrapper, priming };
}

function makeOpenspecEnv() {
  const server = createFakeServer();
  const priming = new FakeSummoner(server);
  function OpenspecWrapper({ children }: { children: ReactNode }) {
    const ref = useRef<FakeSummoner | null>(null);
    if (!ref.current) ref.current = new FakeSummoner(server);
    return (
      <SocketProvider socket={ref.current.socket}>
        <GitProvider>
          <FsProvider>
            <TabProvider>
              <OpenspecProvider>{children}</OpenspecProvider>
            </TabProvider>
          </FsProvider>
        </GitProvider>
      </SocketProvider>
    );
  }
  return { OpenspecWrapper, priming };
}

// ── ControlledPaneHeader: mirrors PaneLeafContent's stateful wiring ──

function ControlledPaneHeader({
  cwd,
  openspecWrapper = false,
}: {
  cwd?: string;
  openspecWrapper?: boolean;
}) {
  const [activeTool, setActiveTool] = useState<'files' | 'git' | 'spec' | null>(null);
  const header = (
    <PaneHeader paneId="p1" cwd={cwd} activeTool={activeTool} onToolSelect={setActiveTool} />
  );
  const panel = activeTool && cwd ? <RightPane cwd={cwd} initialTab={activeTool} /> : null;
  if (openspecWrapper) {
    return (
      <Wrapper>
        {header}
        {panel}
      </Wrapper>
    );
  }
  return (
    <Wrapper>
      {header}
      {panel}
    </Wrapper>
  );
}

// ── E.1–E.5: PaneHeader context panel toolbar ──

describe('ContextPanel (E.1) PaneHeader shows context toolbar', () => {
  it('shows Files, Git, Spec toolbar icons when cwd is provided', () => {
    render(<ControlledPaneHeader cwd="/project" />);
    expect(screen.getByRole('button', { name: /Files/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Git/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spec/i })).toBeInTheDocument();
  });

  it('does not show toolbar when cwd is not provided', () => {
    render(<ControlledPaneHeader />);
    expect(screen.queryByRole('button', { name: /Files/i })).not.toBeInTheDocument();
  });
});

describe('ContextPanel (E.2) clicking icon expands context panel', () => {
  it('clicking Files icon shows right pane body', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneHeader cwd="/project" />);
    await user.click(screen.getByRole('button', { name: /Files/i }));
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });

  it('clicking Git icon shows right pane body with git tab active', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneHeader cwd="/project" />);
    await user.click(screen.getByRole('button', { name: /Git/i }));
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
  });
});

describe('ContextPanel (E.3) context panel cwd follows session', () => {
  it('context panel shows the cwd from the session', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneHeader cwd="/my/project" />);
    await user.click(screen.getByRole('button', { name: /Files/i }));
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toHaveAttribute(
      'data-cwd',
      '/my/project',
    );
  });
});

describe('ContextPanel (E.4) clicking same icon collapses panel', () => {
  it('clicking same icon again closes the context panel', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneHeader cwd="/project" />);
    const filesBtn = screen.getByRole('button', { name: 'Files' });
    await user.click(filesBtn);
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
    await user.click(filesBtn);
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
  });
});

describe('ContextPanel (E.5) context panel has tab navigation', () => {
  it('switching tabs in context panel changes the active tool', async () => {
    const user = userEvent.setup();
    render(<ControlledPaneHeader cwd="/project" />);
    await user.click(screen.getByRole('button', { name: 'Files' }));
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');

    await user.click(screen.getByRole('tab', { name: /Git/i }));
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
  });
});

// ── E.6–E.8: ContextPanelGit real content ──

describe('ContextPanelGit (E.6) shows branch and changed files', () => {
  it('displays branch name and dirty changed files', async () => {
    const { GitWrapper, priming } = makeGitEnv();
    priming.git()!.markAsRepo('/my/repo');
    priming.git()!.setBranch('feat/awesome');
    priming.git()!.setChangedFiles([
      { status: 'M ', file: 'src/foo.ts' },
      { status: '??', file: 'bar.ts' },
    ]);

    render(
      <GitWrapper>
        <ContextPanelGit cwd="/my/repo" />
      </GitWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('context-panel-git')).toBeInTheDocument();
      expect(screen.getByText(/feat\/awesome/)).toBeInTheDocument();
    });

    expect(screen.getByText(/src\/foo\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/bar\.ts/)).toBeInTheDocument();
  });

  it('shows loading state before data arrives', () => {
    render(
      <Wrapper>
        <ContextPanelGit cwd="/my/repo" />
      </Wrapper>,
    );
    expect(screen.getByTestId('context-panel-git')).toBeInTheDocument();
    // loading indicator present before data arrives
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

describe('ContextPanelGit (E.7) refresh button re-fetches', () => {
  it('clicking refresh button triggers a new status fetch', async () => {
    const user = userEvent.setup();
    const { GitWrapper, priming } = makeGitEnv();
    priming.git()!.markAsRepo('/my/repo');
    priming.git()!.setBranch('main');
    priming.git()!.setChangedFiles([]);

    render(
      <GitWrapper>
        <ContextPanelGit cwd="/my/repo" />
      </GitWrapper>,
    );

    await waitFor(() => expect(screen.getByText(/main/)).toBeInTheDocument());

    // Now change the branch in the fake and click refresh
    priming.git()!.setBranch('updated-branch');
    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(screen.getByText(/updated-branch/)).toBeInTheDocument());
  });
});

describe('ContextPanelGit (E.8) file click shows diff', () => {
  it('clicking a file expands the diff', async () => {
    const user = userEvent.setup();
    const { GitWrapper, priming } = makeGitEnv();
    priming.git()!.markAsRepo('/my/repo');
    priming.git()!.setBranch('main');
    priming.git()!.setChangedFiles([{ status: 'M ', file: 'src/foo.ts' }]);
    priming.git()!.setDiff('diff --git a/src/foo.ts');

    render(
      <GitWrapper>
        <ContextPanelGit cwd="/my/repo" />
      </GitWrapper>,
    );

    await waitFor(() => expect(screen.getByText(/src\/foo\.ts/)).toBeInTheDocument());
    await user.click(screen.getByText(/src\/foo\.ts/));

    await waitFor(() => expect(screen.getByText(/diff --git/)).toBeInTheDocument());
  });
});

// ── E.9–E.10: ContextPanelFiles real content ──

describe('ContextPanelFiles (E.9) shows directory listing', () => {
  it('displays directories and files at the given cwd', async () => {
    const { FsWrapper, priming } = makeFsEnv();
    priming.filesystem().fromTree('/project', {
      src: { 'index.ts': 'export {}' },
      'README.md': '# hello',
    });

    render(
      <FsWrapper>
        <ContextPanelFiles cwd="/project" />
      </FsWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('context-panel-files')).toBeInTheDocument();
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });
  });
});

describe('ContextPanelFiles (E.10) clicking directory navigates into it', () => {
  it('clicking a directory updates the listing and shows breadcrumbs', async () => {
    const user = userEvent.setup();
    const { FsWrapper, priming } = makeFsEnv();
    priming.filesystem().fromTree('/project', {
      src: { 'index.ts': 'content', components: {} },
    });

    render(
      <FsWrapper>
        <ContextPanelFiles cwd="/project" />
      </FsWrapper>,
    );

    await waitFor(() => expect(screen.getByText('src')).toBeInTheDocument());
    await user.click(screen.getByText('src'));

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
      expect(screen.getByText('components')).toBeInTheDocument();
    });

    // breadcrumb back link shows root path segment
    expect(screen.getByText('project')).toBeInTheDocument();
  });
});

// ── ContextPanelSpec ──

describe('ContextPanelSpec shows changes list with task progress', () => {
  it('displays change names and task progress', async () => {
    const { OpenspecWrapper, priming } = makeOpenspecEnv();
    priming.openspec()!.setChanges([
      { name: 'add-auth', tasks: { done: 3, total: 7 }, status: 'in-progress' },
      { name: 'fix-login', tasks: null, status: 'no-tasks' },
    ]);

    render(
      <OpenspecWrapper>
        <ContextPanelSpec cwd="/repo" />
      </OpenspecWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('context-panel-spec')).toBeInTheDocument();
      expect(screen.getByText('add-auth')).toBeInTheDocument();
    });

    expect(screen.getByText('3/7 tasks')).toBeInTheDocument();
    expect(screen.getByText('fix-login')).toBeInTheDocument();
  });
});

describe('ContextPanelSpec shows specs list', () => {
  it('displays capability names from specs', async () => {
    const { OpenspecWrapper, priming } = makeOpenspecEnv();
    priming.openspec()!.setSpecs([{ capability: 'user-auth' }, { capability: 'file-browser' }]);

    render(
      <OpenspecWrapper>
        <ContextPanelSpec cwd="/repo" />
      </OpenspecWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('user-auth')).toBeInTheDocument();
      expect(screen.getByText('file-browser')).toBeInTheDocument();
    });
  });
});

// ── CS.4: Click change → show tasks.md content ──

describe('ContextPanelSpec (CS.4) clicking change shows tasks.md content', () => {
  it('clicking a change name fetches and displays tasks content', async () => {
    const user = userEvent.setup();
    const { OpenspecWrapper, priming } = makeOpenspecEnv();
    priming
      .openspec()!
      .setChanges([{ name: 'add-auth', tasks: { done: 3, total: 7 }, status: 'in-progress' }]);
    priming
      .openspec()!
      .setContent('/repo', 'change', 'add-auth', 'tasks', '- [x] Task 1\n- [ ] Task 2');

    render(
      <OpenspecWrapper>
        <ContextPanelSpec cwd="/repo" />
      </OpenspecWrapper>,
    );

    await waitFor(() => expect(screen.getByText('add-auth')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'add-auth' }));

    await waitFor(() => expect(screen.getByText(/Task 1/)).toBeInTheDocument());
    expect(screen.getByText(/Task 2/)).toBeInTheDocument();
  });

  it('clicking same change again collapses the content', async () => {
    const user = userEvent.setup();
    const { OpenspecWrapper, priming } = makeOpenspecEnv();
    priming
      .openspec()!
      .setChanges([{ name: 'add-auth', tasks: { done: 1, total: 2 }, status: 'in-progress' }]);
    priming.openspec()!.setContent('/repo', 'change', 'add-auth', 'tasks', '- [x] Task 1');

    render(
      <OpenspecWrapper>
        <ContextPanelSpec cwd="/repo" />
      </OpenspecWrapper>,
    );

    await waitFor(() => expect(screen.getByText('add-auth')).toBeInTheDocument());
    const btn = screen.getByRole('button', { name: 'add-auth' });
    await user.click(btn);
    await waitFor(() => expect(screen.getByText(/Task 1/)).toBeInTheDocument());

    await user.click(btn);
    expect(screen.queryByText(/Task 1/)).not.toBeInTheDocument();
  });
});
