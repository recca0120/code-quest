import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavigationProvider, useNavigationActions } from '@/contexts/NavigationContext';
import { TabProvider } from '@/contexts/TabContext';
import { TabContainer } from '../TabContainer.tsx';

// Mock heavy contexts that TabContainer uses but are irrelevant to filtering
vi.mock('@/contexts/SessionContext', () => ({
  useSession: () => ({ closeSession: vi.fn() }),
}));
vi.mock('@/contexts/GitContext', () => ({
  useGitState: () => ({ listing: {} }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectState: () => ({ activeProjectCwd: '/projects/app' }),
}));
vi.mock('@/hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ isDesktop: false }),
}));
// ChannelProvider / ChatView are deep — stub them out
vi.mock('@/contexts/channel', () => ({
  ChannelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../chat/ChatView.tsx', () => ({
  ChatView: () => <div data-testid="chat-view" />,
}));
vi.mock('../RightPane.tsx', () => ({
  RightPane: () => <div data-testid="right-pane" />,
}));

const PROJECT_CWD = '/projects/app';

function renderTabContainer(worktreeFilter: string | null = null) {
  const initialTabs = {
    'sess-main': {
      tabStatus: 'idle' as const,
      mode: 'resume' as const,
      cwd: '/projects/app/main',
      title: 'main',
    },
    'sess-feat': {
      tabStatus: 'idle' as const,
      mode: 'resume' as const,
      cwd: '/projects/app/feat',
      title: 'feat',
    },
  };
  return render(
    <NavigationProvider>
      <TabProvider initialState={{ tabs: initialTabs, activeTabId: 'sess-main' }}>
        <TabContainerWithFilter worktreeFilter={worktreeFilter} />
      </TabProvider>
    </NavigationProvider>,
  );
}

/** Helper: sets selectedWorktreeCwd via NavigationActions and renders TabContainer */
function TabContainerWithFilter(_: { worktreeFilter: string | null }) {
  return <TabContainer projectCwd={PROJECT_CWD} />;
}

describe('TabContainer — worktree filtering', () => {
  it('shows all tabs when no worktree is selected', () => {
    renderTabContainer(null);
    const tabBar = screen.getByRole('tablist', { name: 'tab-bar' });
    expect(within(tabBar).getAllByRole('tab')).toHaveLength(2);
  });

  it('filters TabBar to only tabs matching selectedWorktreeCwd', async () => {
    // Render with NavigationProvider so we can set selectedWorktreeCwd via actions
    const initialTabs = {
      'sess-main': {
        tabStatus: 'idle' as const,
        mode: 'resume' as const,
        cwd: '/projects/app/main',
        title: 'main',
      },
      'sess-feat': {
        tabStatus: 'idle' as const,
        mode: 'resume' as const,
        cwd: '/projects/app/feat',
        title: 'feat',
      },
    };

    let navActions: ReturnType<typeof useNavigationActions> | null = null;

    function Harness() {
      navActions = useNavigationActions();
      return <TabContainer projectCwd={PROJECT_CWD} />;
    }

    render(
      <NavigationProvider>
        <TabProvider initialState={{ tabs: initialTabs, activeTabId: 'sess-main' }}>
          <Harness />
        </TabProvider>
      </NavigationProvider>,
    );

    // Before filter: 2 tabs
    expect(
      within(screen.getByRole('tablist', { name: 'tab-bar' })).getAllByRole('tab'),
    ).toHaveLength(2);

    // Set worktree filter to only show 'feat' tabs
    await act(async () => {
      navActions!.setSelectedWorktree(PROJECT_CWD, '/projects/app/feat');
    });

    // After filter: only 1 tab ('feat') should appear
    expect(
      within(screen.getByRole('tablist', { name: 'tab-bar' })).getAllByRole('tab'),
    ).toHaveLength(1);
  });
});
