/**
 * Group 6: WorkspaceTabBar (tmux window) feature tests
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WorkspaceTabBar } from '@/components/workspace/WorkspaceTabBar';
import { SocketProvider } from '@/contexts/SocketContext';
import {
  TabProvider,
  usePaneActions,
  usePaneState,
  useTabActions,
  useWorkspaceTab,
} from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

// 6.1: new workspace tab shows in TabBar, pane area has fresh pane tree
describe('WorkspaceTabBar (6.1) adding a new tab', () => {
  it('adds a new workspace tab and switches to it', async () => {
    const user = userEvent.setup();

    function Test() {
      const { workspaceTabs, activeWorkspaceTabId, addWorkspaceTab } = useWorkspaceTab();
      return (
        <>
          <span data-testid="tab-count">{workspaceTabs.length}</span>
          <span data-testid="active-id">{activeWorkspaceTabId ?? 'none'}</span>
          <button type="button" onClick={() => addWorkspaceTab()}>
            add
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );
    expect(screen.getByTestId('tab-count')).toHaveTextContent('1');
    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('tab-count')).toHaveTextContent('2');
  });

  it('switching tabs changes pane tree', async () => {
    const user = userEvent.setup();
    let firstTabId = '';
    let secondTabId = '';

    function Test() {
      const { workspaceTabs, activeWorkspaceTabId, addWorkspaceTab, switchWorkspaceTab } =
        useWorkspaceTab();
      const { paneRoot } = usePaneState();

      if (workspaceTabs.length === 1 && !firstTabId) {
        firstTabId = workspaceTabs[0]!.id;
      }
      if (workspaceTabs.length === 2 && !secondTabId) {
        secondTabId = workspaceTabs[1]!.id;
      }

      return (
        <>
          <span data-testid="active-id">{activeWorkspaceTabId ?? 'none'}</span>
          <span data-testid="pane-root-id">{paneRoot.id}</span>
          <button type="button" onClick={() => addWorkspaceTab()}>
            add
          </button>
          <button type="button" onClick={() => firstTabId && switchWorkspaceTab(firstTabId)}>
            switch-first
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );
    const initialRootId = screen.getByTestId('pane-root-id').textContent;
    await user.click(screen.getByRole('button', { name: 'add' }));
    const afterAddRootId = screen.getByTestId('pane-root-id').textContent;
    expect(afterAddRootId).not.toBe(initialRootId); // new tab has different pane root

    await user.click(screen.getByRole('button', { name: 'switch-first' }));
    expect(screen.getByTestId('pane-root-id').textContent).toBe(initialRootId);
  });
});

// 6.2: WorkspaceTabBar renders tabs and switch on click
describe('WorkspaceTabBar (6.2) rendering', () => {
  it('renders a tab for each workspace tab', async () => {
    const user = userEvent.setup();

    function Test() {
      const { addWorkspaceTab } = useWorkspaceTab();
      return (
        <>
          <button type="button" onClick={() => addWorkspaceTab()}>
            add
          </button>
          <WorkspaceTabBar />
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );
    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(2);
  });
});

// 6.3: removing a workspace tab
describe('WorkspaceTabBar (6.3) removing a tab', () => {
  it('removes a workspace tab when closed', async () => {
    const user = userEvent.setup();

    function Test() {
      const { workspaceTabs, addWorkspaceTab, removeWorkspaceTab } = useWorkspaceTab();
      const tab2Id = workspaceTabs[1]?.id;

      return (
        <>
          <span data-testid="tab-count">{workspaceTabs.length}</span>
          <button type="button" onClick={() => addWorkspaceTab()}>
            add
          </button>
          <button type="button" onClick={() => tab2Id && removeWorkspaceTab(tab2Id)}>
            remove-second
          </button>
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('tab-count')).toHaveTextContent('2');
    await user.click(screen.getByRole('button', { name: 'remove-second' }));
    expect(screen.getByTestId('tab-count')).toHaveTextContent('1');
  });
});

// 6.4: workspace tab shows busy indicator when any session in its pane tree is busy
describe('WorkspaceTabBar (6.4) busy indicator', () => {
  it('tab shows data-busy when a session in its pane tree is processing', async () => {
    const user = userEvent.setup();

    function Test() {
      const { paneRoot } = usePaneState();
      const { setSessionInPane } = usePaneActions();
      const { addTab, setTabStatus } = useTabActions();
      const leafId = paneRoot.type === 'leaf' ? paneRoot.id : null;

      return (
        <>
          <button
            type="button"
            onClick={() => {
              addTab('sess-busy', '/test');
              if (leafId) setSessionInPane(leafId, 'sess-busy', null);
            }}
          >
            setup
          </button>
          <button type="button" onClick={() => setTabStatus('sess-busy', 'processing')}>
            make-busy
          </button>
          <WorkspaceTabBar />
        </>
      );
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'setup' }));
    // Initially idle — no busy indicator
    expect(screen.getByTestId('workspace-tab')).not.toHaveAttribute('data-busy');

    await user.click(screen.getByRole('button', { name: 'make-busy' }));
    // Now the session is processing — tab should show busy indicator
    expect(screen.getByTestId('workspace-tab')).toHaveAttribute('data-busy');
  });
});

// 6.5: workspace tab double-click enters inline rename mode
describe('WorkspaceTabBar (6.5) inline rename', () => {
  it('double-clicking tab label shows an input with current label', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <WorkspaceTabBar />
      </Wrapper>,
    );

    await user.dblClick(screen.getByRole('button', { name: /rename tab/ })!);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('typing and pressing Enter renames the tab', async () => {
    const user = userEvent.setup();
    let renamedLabel = '';

    function Test() {
      const { workspaceTabs } = useWorkspaceTab();
      renamedLabel = workspaceTabs[0]?.label ?? '';
      return <WorkspaceTabBar />;
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );

    await user.dblClick(screen.getByRole('button', { name: /rename tab/ })!);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'My Layout');
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(renamedLabel).toBe('My Layout');
  });
});
