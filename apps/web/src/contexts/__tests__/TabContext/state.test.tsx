import type { SessionStateSummary } from '@code-quest/schemas';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import {
  NavigationProvider,
  useNavigationActions,
  useNavigationState,
} from '@/contexts/NavigationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, useTabActions, useTabState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function renderInTab(ui: ReactElement) {
  const summoner = createFakeSummoner();
  const user = userEvent.setup();
  render(
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{ui}</TabProvider>
    </SocketProvider>,
  );
  return { claude: summoner.claude(), user };
}

function renderWithProjectAndSessions(
  ui: ReactElement,
  initial: { cwd: string; sessions?: SessionStateSummary[] },
) {
  const summoner = createFakeSummoner();
  let sessions = initial.sessions ?? [];
  const tree = (
    <SocketProvider socket={summoner.socket}>
      <AppConfigProvider>
        <SessionProvider>
          <ProjectProvider>
            <NavigationProvider>
              <TabProvider cwd={initial.cwd} sessions={sessions}>
                {ui}
              </TabProvider>
            </NavigationProvider>
          </ProjectProvider>
        </SessionProvider>
      </AppConfigProvider>
    </SocketProvider>
  );
  const { rerender } = render(tree);
  function setSessions(next: SessionStateSummary[]) {
    sessions = next;
    rerender(
      <SocketProvider socket={summoner.socket}>
        <AppConfigProvider>
          <SessionProvider>
            <ProjectProvider>
              <NavigationProvider>
                <TabProvider cwd={initial.cwd} sessions={sessions}>
                  {ui}
                </TabProvider>
              </NavigationProvider>
            </ProjectProvider>
          </SessionProvider>
        </AppConfigProvider>
      </SocketProvider>,
    );
  }
  return { setSessions };
}

describe('TabProvider', () => {
  describe('pendingActivateChannel intent (Decision 10)', () => {
    function ProbeAndTrigger({ trigger }: { trigger: { cwd: string; channelId: string } }) {
      const { activeTabId } = useTabState();
      const { pendingActivateChannel } = useNavigationState();
      const { requestActivateChannel } = useNavigationActions();
      return (
        <>
          <span role="status" aria-label="active">
            {activeTabId ?? 'null'}
          </span>
          <span role="status" aria-label="pending">
            {JSON.stringify(pendingActivateChannel)}
          </span>
          <button type="button" onClick={() => requestActivateChannel(trigger.channelId)}>
            request
          </button>
        </>
      );
    }

    it('matching cwd + channel already in tabs → setActiveTab + clearPendingActivate', async () => {
      renderWithProjectAndSessions(
        <ProbeAndTrigger trigger={{ cwd: '/proj', channelId: 'ch-1' }} />,
        {
          cwd: '/proj',
          sessions: [{ channelId: 'ch-1', state: 'idle', cwd: '/proj', projectRoot: '/proj' }],
        },
      );

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByText('request'));

      await waitFor(() => {
        expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('ch-1');
        expect(screen.getByRole('status', { name: 'pending' })).toHaveTextContent('null');
      });
    });

    it('matching cwd + channel NOT yet in tabs → wait (no clear), activate when channel appears', async () => {
      const { setSessions } = renderWithProjectAndSessions(
        <ProbeAndTrigger trigger={{ cwd: '/proj', channelId: 'ch-late' }} />,
        { cwd: '/proj', sessions: [] },
      );

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByText('request'));

      // Pending stays set; no active tab yet
      expect(screen.getByRole('status', { name: 'pending' })).toHaveTextContent(
        '"channelId":"ch-late"',
      );
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('null');

      // Channel appears via sessions prop
      setSessions([{ channelId: 'ch-late', state: 'idle', cwd: '/proj', projectRoot: '/proj' }]);

      await waitFor(() => {
        expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('ch-late');
        expect(screen.getByRole('status', { name: 'pending' })).toHaveTextContent('null');
      });
    });

    it('global TabProvider activates channel regardless of intent cwd', async () => {
      // Design Decision 4: single global TabProvider handles all channels.
      // No cwd guard — intent with any cwd activates the channel if it's in tabs.
      renderWithProjectAndSessions(
        <ProbeAndTrigger trigger={{ cwd: '/other', channelId: 'ch-target' }} />,
        {
          cwd: '/proj',
          sessions: [
            { channelId: 'ch-a', state: 'idle', cwd: '/proj', projectRoot: '/proj' },
            { channelId: 'ch-target', state: 'idle', cwd: '/proj', projectRoot: '/proj' },
          ],
        },
      );

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      await user.click(screen.getByText('request'));

      // Channel is in tabs → activates immediately, pending clears
      await vi.waitFor(() => {
        expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('ch-target');
        expect(screen.getByRole('status', { name: 'pending' })).toHaveTextContent('null');
      });
    });
  });

  describe('replaceTab(oldId, newId)', () => {
    function Harness({ trigger }: { trigger: { oldId: string; newId: string } }) {
      const { tabs, activeTabId } = useTabState();
      const { addTab, setActiveTab, replaceTab } = useTabActions();
      return (
        <>
          <span role="status" aria-label="tabs">
            {JSON.stringify(Object.keys(tabs))}
          </span>
          <span role="status" aria-label="active">
            {activeTabId ?? 'null'}
          </span>
          <button type="button" onClick={() => addTab('old', '/proj')}>
            seed-old
          </button>
          <button type="button" onClick={() => addTab('other')}>
            seed-other
          </button>
          <button type="button" onClick={() => setActiveTab('old')}>
            activate-old
          </button>
          <button type="button" onClick={() => replaceTab(trigger.oldId, trigger.newId)}>
            replace
          </button>
        </>
      );
    }

    it('replaces the entry keyed oldId with newId; activeTabId follows if it was oldId', async () => {
      const { user } = renderInTab(<Harness trigger={{ oldId: 'old', newId: 'new' }} />);

      await user.click(screen.getByText('seed-old'));
      await user.click(screen.getByText('replace'));

      expect(JSON.parse(screen.getByRole('status', { name: 'tabs' }).textContent!)).toEqual([
        'new',
      ]);
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('new');
    });

    it('is a no-op when oldId is not in tabs', async () => {
      const { user } = renderInTab(<Harness trigger={{ oldId: 'missing', newId: 'new' }} />);

      await user.click(screen.getByText('seed-old'));
      await user.click(screen.getByText('replace'));

      expect(JSON.parse(screen.getByRole('status', { name: 'tabs' }).textContent!)).toEqual([
        'old',
      ]);
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('old');
    });
  });

  describe('state management', () => {
    it('provides initial empty state', () => {
      function Test() {
        const { tabs, activeTabId } = useTabState();
        return (
          <>
            <span role="status" aria-label="tabs">
              {JSON.stringify(tabs)}
            </span>
            <span role="status" aria-label="active">
              {activeTabId ?? 'null'}
            </span>
          </>
        );
      }
      renderInTab(<Test />);
      expect(screen.getByRole('status', { name: 'tabs' })).toHaveTextContent('{}');
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('null');
    });

    it('addTab adds a tab', async () => {
      function Test() {
        const { tabs } = useTabState();
        const { addTab } = useTabActions();
        return (
          <>
            <span role="status" aria-label="tabs">
              {JSON.stringify(tabs)}
            </span>
            <button type="button" onClick={() => addTab('tab-1')}>
              add
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('add'));
      expect(JSON.parse(screen.getByRole('status', { name: 'tabs' }).textContent!)).toHaveProperty(
        'tab-1',
      );
      expect(
        JSON.parse(screen.getByRole('status', { name: 'tabs' }).textContent!)['tab-1'],
      ).toEqual({
        title: undefined,
        tabStatus: 'connecting',
        mode: 'resume',
      });
    });

    it('addTab does not duplicate existing tab', async () => {
      function Test() {
        const { tabs } = useTabState();
        const { addTab } = useTabActions();
        return (
          <>
            <span role="status" aria-label="count">
              {Object.keys(tabs).length}
            </span>
            <button type="button" onClick={() => addTab('tab-1')}>
              add
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('add'));
      await user.click(screen.getByText('add'));
      expect(screen.getByRole('status', { name: 'count' })).toHaveTextContent('1');
    });

    it('removeTab removes a tab', async () => {
      function Test() {
        const { tabs } = useTabState();
        const { addTab, removeTab } = useTabActions();
        return (
          <>
            <span role="status" aria-label="has">
              {String('tab-1' in tabs)}
            </span>
            <button type="button" onClick={() => addTab('tab-1')}>
              add
            </button>
            <button type="button" onClick={() => removeTab('tab-1')}>
              remove
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('add'));
      await user.click(screen.getByText('remove'));
      expect(screen.getByRole('status', { name: 'has' })).toHaveTextContent('false');
    });

    it('removeTab switches activeTabId when active tab is removed', async () => {
      function Test() {
        const { activeTabId } = useTabState();
        const { addTab, setActiveTab, removeTab } = useTabActions();
        return (
          <>
            <span role="status" aria-label="active">
              {activeTabId ?? 'null'}
            </span>
            <button
              type="button"
              onClick={() => {
                addTab('tab-1');
                addTab('tab-2');
                setActiveTab('tab-2');
              }}
            >
              setup
            </button>
            <button type="button" onClick={() => removeTab('tab-2')}>
              remove
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('setup'));
      await user.click(screen.getByText('remove'));
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('tab-1');
    });

    it('removeTab sets activeTabId to null when last tab removed', async () => {
      function Test() {
        const { activeTabId } = useTabState();
        const { addTab, setActiveTab, removeTab } = useTabActions();
        return (
          <>
            <span role="status" aria-label="active">
              {activeTabId ?? 'null'}
            </span>
            <button
              type="button"
              onClick={() => {
                addTab('tab-1');
                setActiveTab('tab-1');
              }}
            >
              setup
            </button>
            <button type="button" onClick={() => removeTab('tab-1')}>
              remove
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('setup'));
      await user.click(screen.getByText('remove'));
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('null');
    });

    it('setActiveTab updates activeTabId', async () => {
      function Test() {
        const { activeTabId } = useTabState();
        const { addTab, setActiveTab } = useTabActions();
        return (
          <>
            <span role="status" aria-label="active">
              {activeTabId ?? 'null'}
            </span>
            <button
              type="button"
              onClick={() => {
                addTab('tab-1');
                setActiveTab('tab-1');
              }}
            >
              go
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('go'));
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('tab-1');
    });

    it('setTabTitle updates tab title', async () => {
      function Test() {
        const { tabs } = useTabState();
        const { addTab, setTabTitle } = useTabActions();
        return (
          <>
            <span role="status" aria-label="title">
              {tabs['tab-1']?.title ?? 'none'}
            </span>
            <button type="button" onClick={() => addTab('tab-1')}>
              add
            </button>
            <button type="button" onClick={() => setTabTitle('tab-1', 'Hello')}>
              title
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('add'));
      await user.click(screen.getByText('title'));
      expect(screen.getByRole('status', { name: 'title' })).toHaveTextContent('Hello');
    });

    it('setTabStatus updates tab status', async () => {
      function Test() {
        const { tabs } = useTabState();
        const { addTab, setTabStatus } = useTabActions();
        return (
          <>
            <span role="status" aria-label="status">
              {tabs['tab-1']?.tabStatus ?? 'none'}
            </span>
            <button type="button" onClick={() => addTab('tab-1')}>
              add
            </button>
            <button type="button" onClick={() => setTabStatus('tab-1', 'processing')}>
              processing
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('add'));
      await user.click(screen.getByText('processing'));
      expect(screen.getByRole('status', { name: 'status' })).toHaveTextContent('processing');
    });

    it('setTabTitle updates the tab title without affecting status', async () => {
      function Test() {
        const { tabs } = useTabState();
        const { addTab, setTabTitle } = useTabActions();
        return (
          <>
            <span role="status" aria-label="tab">
              {JSON.stringify(tabs['tab-1'] ?? null)}
            </span>
            <button type="button" onClick={() => addTab('tab-1')}>
              add
            </button>
            <button type="button" onClick={() => setTabTitle('tab-1', 'Hello')}>
              title
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('add'));
      await user.click(screen.getByText('title'));
      const tab = JSON.parse(screen.getByRole('status', { name: 'tab' }).textContent!);
      expect(tab.title).toBe('Hello');
      expect(tab.tabStatus).toBe('connecting');
    });

    it('setTabStatus updates the tab status without affecting title', async () => {
      function Test() {
        const { tabs } = useTabState();
        const { addTab, setTabStatus } = useTabActions();
        return (
          <>
            <span role="status" aria-label="tab">
              {JSON.stringify(tabs['tab-1'] ?? null)}
            </span>
            <button type="button" onClick={() => addTab('tab-1')}>
              add
            </button>
            <button type="button" onClick={() => setTabStatus('tab-1', 'disconnected')}>
              disconnected
            </button>
          </>
        );
      }
      const { user } = renderInTab(<Test />);
      await user.click(screen.getByText('add'));
      await user.click(screen.getByText('disconnected'));
      const tab = JSON.parse(screen.getByRole('status', { name: 'tab' }).textContent!);
      expect(tab.tabStatus).toBe('disconnected');
      expect(tab.title).toBeUndefined();
    });

    it('throws when useTabState is called outside provider', () => {
      expect(() => renderHook(() => useTabState())).toThrow(
        'useTabState must be used within a TabProvider',
      );
    });

    it('throws when useTabActions is called outside provider', () => {
      expect(() => renderHook(() => useTabActions())).toThrow(
        'useTabActions must be used within a TabProvider',
      );
    });
  });

  describe('split mode is removed', () => {
    it('TabActions does not expose enterSplit / exitSplit', () => {
      const summoner = createFakeSummoner();
      const { result } = renderHook(() => useTabActions(), {
        wrapper: ({ children }) => (
          <SocketProvider socket={summoner.socket}>
            <TabProvider>{children}</TabProvider>
          </SocketProvider>
        ),
      });
      expect(result.current).not.toHaveProperty('enterSplit');
      expect(result.current).not.toHaveProperty('exitSplit');
    });

    it('TabState does not expose splitTabId', () => {
      const summoner = createFakeSummoner();
      const { result } = renderHook(() => useTabState(), {
        wrapper: ({ children }) => (
          <SocketProvider socket={summoner.socket}>
            <TabProvider>{children}</TabProvider>
          </SocketProvider>
        ),
      });
      expect(result.current).not.toHaveProperty('splitTabId');
    });
  });
});
