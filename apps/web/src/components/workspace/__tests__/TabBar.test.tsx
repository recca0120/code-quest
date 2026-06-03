import * as Tabs from '@radix-ui/react-tabs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar, type TabInfo } from '../TabBar.tsx';

const tabs: TabInfo[] = [
  { sessionId: 'sess-1', title: 'Chat 1', status: 'idle' },
  { sessionId: 'sess-2', title: 'Chat 2', status: 'processing' },
  { sessionId: 'sess-3', status: 'disconnected' },
];

/** TabBar requires an enclosing `<Tabs.Root>` (provided by TabContainer in
 *  prod). Wrap with controlled value matching `activeTabId`. */
function withRoot(activeTabId: string | null, children: ReactNode) {
  return (
    <Tabs.Root value={activeTabId ?? undefined} onValueChange={() => {}}>
      {children}
    </Tabs.Root>
  );
}

function renderTabBar(overrides: Partial<Parameters<typeof TabBar>[0]> = {}) {
  const props = {
    tabs,
    activeTabId: 'sess-1' as string | null,
    onSelectTab: vi.fn(),
    onCloseTab: vi.fn(),
    ...overrides,
  };
  return render(withRoot(props.activeTabId, <TabBar {...props} />));
}

describe('TabBar worktree grouping', () => {
  it('renders a scope-tag `projectName/branch` when worktree present', () => {
    render(
      withRoot(
        'wt',
        <TabBar
          tabs={[
            {
              sessionId: 'wt',
              title: 't',
              status: 'idle',
              projectName: 'code-quest',
              worktree: { name: 'feat-x', path: '/p', branch: 'feat-x' },
            },
          ]}
          activeTabId="wt"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
        />,
      ),
    );
    expect(screen.getByLabelText('tab-scope-tag')).toHaveTextContent('code-quest/feat-x');
  });

  it('no scope-tag when tab has no worktree (non-git)', () => {
    render(
      withRoot(
        't',
        <TabBar
          tabs={[{ sessionId: 't', title: 't', status: 'idle' }]}
          activeTabId="t"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
        />,
      ),
    );
    expect(screen.queryByLabelText('tab-scope-tag')).toBeNull();
  });

  // Note: the standalone `tab-worktree-badge` (⎇ branch) was removed in the
  // F.html visual alignment — `tab-scope-tag` (`projectName/branch`) covers the
  // same information without duplication. Branch fallback to `worktree.name`
  // is now exercised via the scope-tag below.
  it('scope-tag falls back to worktree name when branch missing', () => {
    render(
      withRoot(
        'wt',
        <TabBar
          tabs={[
            {
              sessionId: 'wt',
              title: 't',
              status: 'idle',
              projectName: 'cc',
              worktree: { name: 'only-name', path: '/p/.claude/worktrees/only-name' },
            },
          ]}
          activeTabId="wt"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
        />,
      ),
    );
    expect(screen.getByLabelText('tab-scope-tag').textContent).toBe('cc/only-name');
  });

  it('no divider span between main-tree and worktree tabs — scope tag differentiates groups', () => {
    render(
      withRoot(
        'main',
        <TabBar
          tabs={[
            { sessionId: 'main', title: 'main', status: 'idle' },
            {
              sessionId: 'wt',
              title: 'feat',
              status: 'idle',
              projectName: 'cc',
              worktree: { name: 'feat', path: '/repo/.claude/worktrees/feat', branch: 'feat' },
            },
          ]}
          activeTabId="main"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
        />,
      ),
    );
    expect(screen.queryByLabelText('tab-divider')).toBeNull();
  });

  it('main-tree tab sorted before worktree tab', () => {
    render(
      withRoot(
        'wt',
        <TabBar
          tabs={[
            {
              sessionId: 'wt',
              title: 'feat',
              status: 'idle',
              projectName: 'judgments',
              worktree: {
                name: 'test',
                path: '/judgments/.claude/worktrees/test',
                branch: 'feature/test',
              },
            },
            { sessionId: 'main', title: 'main', status: 'idle' },
          ]}
          activeTabId="wt"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
        />,
      ),
    );
    const allTabs = screen.getAllByRole('tab');
    expect(allTabs[0]).toHaveTextContent('main');
    expect(allTabs[1]).toHaveTextContent('feat');
  });

  it('main-tree tab shows no scope tag even when worktree listing includes the main worktree entry', () => {
    render(
      withRoot(
        'main',
        <TabBar
          tabs={[
            { sessionId: 'main', title: 'main', status: 'idle' },
            {
              sessionId: 'wt',
              title: 'feat',
              status: 'idle',
              projectName: 'judgments',
              worktree: {
                name: 'test',
                path: '/judgments/.claude/worktrees/test',
                branch: 'feature/test',
              },
            },
          ]}
          activeTabId="main"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
        />,
      ),
    );
    expect(screen.getAllByRole('note', { name: 'tab-scope-tag' })).toHaveLength(1);
  });
});

describe('TabBar', () => {
  it('renders all tabs', () => {
    renderTabBar();
    expect(screen.getByText('Chat 1')).toBeInTheDocument();
    expect(screen.getByText('Chat 2')).toBeInTheDocument();
    expect(screen.getByText('sess-3'.slice(0, 8))).toBeInTheDocument();
  });

  it('highlights active tab', () => {
    renderTabBar();
    const activeTab = screen.getByRole('tab', { selected: true });
    expect(activeTab).toHaveTextContent('Chat 1');
  });

  it('calls onSelectTab when clicking a tab', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderTabBar({ onSelectTab: onSelect });
    await user.click(screen.getByText('Chat 2'));
    expect(onSelect).toHaveBeenCalledWith('sess-2');
  });

  it('shows confirm dialog before closing tab', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderTabBar({ onCloseTab: onClose });
    await user.click(screen.getByLabelText('Close Chat 1'));

    // Dialog shown with message
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/close this session/i)).toBeInTheDocument();

    // Confirm closes
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledWith('sess-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancel dialog does not close tab', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderTabBar({ onCloseTab: onClose });
    await user.click(screen.getByLabelText('Close Chat 1'));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns null when no tabs', () => {
    renderTabBar({ tabs: [], activeTabId: null });
    expect(screen.queryByLabelText('tab-bar')).toBeNull();
  });

  it('renders + button when onNewTab provided', () => {
    renderTabBar({ onNewTab: vi.fn() });
    expect(screen.getByLabelText('New tab')).toBeInTheDocument();
  });

  it('does not render + button when onNewTab not provided', () => {
    renderTabBar();
    expect(screen.queryByLabelText('New tab')).not.toBeInTheDocument();
  });

  it('calls onNewTab when + button clicked', async () => {
    const user = userEvent.setup();
    const onNewTab = vi.fn();
    renderTabBar({ onNewTab });
    await user.click(screen.getByLabelText('New tab'));
    expect(onNewTab).toHaveBeenCalledOnce();
  });
});

describe('TabBar Radix migration', () => {
  it('exposes a tablist with one tab per session via ARIA roles', () => {
    renderTabBar();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(tabs.length);
  });

  it('marks exactly the active tab as aria-selected', () => {
    renderTabBar({ activeTabId: 'sess-2' });
    const selected = screen
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName(/Chat 2/);
  });

  it('roving tabindex: at most one tab is tab-stop (initially the tablist itself, after focus the active trigger)', () => {
    renderTabBar({ activeTabId: 'sess-2' });
    // Radix delegates tab-stop tracking to RovingFocusGroup. At rest, tab
    // triggers all hold tabindex="-1" and the tablist element holds the
    // single tab-stop. Asserting we never have more than one tabbable
    // trigger captures the invariant without coupling to whether init
    // happens pre- or post-focus.
    const focusable = screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0');
    expect(focusable.length).toBeLessThanOrEqual(1);
  });
});
