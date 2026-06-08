import type { SessionStateSummary } from '@code-quest/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, useTabActions, useTabState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

const idleSession = (channelId: string, cwd = '/') => ({
  channelId,
  state: 'idle' as const,
  cwd,
  projectRoot: cwd,
});

function renderWithSessions(ui: ReactElement, initialSessions: SessionStateSummary[] = []) {
  const summoner = createFakeSummoner();
  const user = userEvent.setup();
  let sessions = initialSessions;
  const { rerender } = render(
    <SocketProvider socket={summoner.socket}>
      <TabProvider sessions={sessions}>{ui}</TabProvider>
    </SocketProvider>,
  );
  function setSessions(next: SessionStateSummary[]) {
    sessions = next;
    rerender(
      <SocketProvider socket={summoner.socket}>
        <TabProvider sessions={sessions}>{ui}</TabProvider>
      </SocketProvider>,
    );
  }
  return { user, setSessions };
}

describe('TabProvider', () => {
  describe('tab creation from sessions', () => {
    it('preserves branch from session sync (pane header needs this)', () => {
      function Test() {
        const { tabs, activeTabId } = useTabState();
        const branch = activeTabId ? tabs[activeTabId]?.branch : undefined;
        return (
          <span role="status" aria-label="branch">
            {branch ?? 'none'}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />);
      setSessions([
        {
          channelId: 'ch-1',
          state: 'idle',
          cwd: '/my/project',
          projectRoot: '/my/project',
          branch: 'feat/my-feature',
        },
      ]);
      expect(screen.getByRole('status', { name: 'branch' })).toHaveTextContent('feat/my-feature');
    });

    it('preserves cwd from session sync (resume / fork need this)', () => {
      function Test() {
        const { tabs, activeTabId } = useTabState();
        const cwd = activeTabId ? tabs[activeTabId]?.cwd : undefined;
        return (
          <span role="status" aria-label="cwd">
            {cwd ?? 'none'}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />);
      setSessions([
        { channelId: 'ch-1', state: 'idle', cwd: '/my/project', projectRoot: '/my/project' },
      ]);
      expect(screen.getByRole('status', { name: 'cwd' })).toHaveTextContent('/my/project');
    });

    it('creates tab when session appears', () => {
      function Test() {
        const { tabs } = useTabState();
        return (
          <span role="status" aria-label="count">
            {Object.keys(tabs).length}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />);
      setSessions([idleSession('ch-1')]);
      expect(screen.getByRole('status', { name: 'count' })).toHaveTextContent('1');
    });
  });

  describe('sessions prop sync', () => {
    it('adds tabs for server sessions', () => {
      function Test() {
        const { tabs } = useTabState();
        return (
          <span role="status" aria-label="keys">
            {Object.keys(tabs).sort().join(',')}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />);
      setSessions([idleSession('a'), idleSession('b')]);
      expect(screen.getByRole('status', { name: 'keys' })).toHaveTextContent('a,b');
    });

    it('removes stale tabs when session disappears', () => {
      function Test() {
        const { tabs } = useTabState();
        return (
          <>
            <span role="status" aria-label="has-stale">
              {String('stale' in tabs)}
            </span>
            <span role="status" aria-label="has-fresh">
              {String('fresh' in tabs)}
            </span>
          </>
        );
      }
      const { setSessions } = renderWithSessions(<Test />, [idleSession('stale')]);
      setSessions([idleSession('fresh')]);
      expect(screen.getByRole('status', { name: 'has-stale' })).toHaveTextContent('false');
      expect(screen.getByRole('status', { name: 'has-fresh' })).toHaveTextContent('true');
    });

    it('is idempotent — no change when sessions unchanged', () => {
      function Test() {
        const { tabs } = useTabState();
        return (
          <span role="status" aria-label="tabs">
            {JSON.stringify(tabs)}
          </span>
        );
      }
      const sessions = [idleSession('a')];
      const { setSessions } = renderWithSessions(<Test />, sessions);
      const before = screen.getByRole('status', { name: 'tabs' }).textContent;
      setSessions(sessions);
      expect(screen.getByRole('status', { name: 'tabs' })).toHaveTextContent(before!);
    });

    it('sets activeTabId to first session when no active tab', () => {
      function Test() {
        const { activeTabId } = useTabState();
        return (
          <span role="status" aria-label="active">
            {activeTabId ?? 'null'}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />);
      setSessions([idleSession('x'), idleSession('y')]);
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('x');
    });

    it('preserves activeTabId when session still exists', () => {
      function Test() {
        const { activeTabId } = useTabState();
        return (
          <span role="status" aria-label="active">
            {activeTabId ?? 'null'}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />, [idleSession('keep')]);
      setSessions([idleSession('keep'), idleSession('other')]);
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('keep');
    });

    it('resets activeTabId when active session removed', () => {
      function Test() {
        const { activeTabId } = useTabState();
        return (
          <span role="status" aria-label="active">
            {activeTabId ?? 'null'}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />, [idleSession('dead')]);
      setSessions([idleSession('new')]);
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('new');
    });

    it('handles empty sessions', () => {
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
      const { setSessions } = renderWithSessions(<Test />, [idleSession('old')]);
      setSessions([]);
      expect(screen.getByRole('status', { name: 'tabs' })).toHaveTextContent('{}');
      expect(screen.getByRole('status', { name: 'active' })).toHaveTextContent('null');
    });

    it('does not re-add tab for session with exited state', () => {
      function Test() {
        const { tabs } = useTabState();
        return (
          <span role="status" aria-label="keys">
            {Object.keys(tabs).sort().join(',') || 'empty'}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />, [idleSession('A')]);

      // session dies — removed from sessions
      setSessions([]);
      expect(screen.getByRole('status', { name: 'keys' })).toHaveTextContent('empty');

      // server broadcasts session:states with exited state (race condition) — should NOT re-add tab
      setSessions([{ channelId: 'A', state: 'exited' as const, projectRoot: '/test/project' }]);
      expect(screen.getByRole('status', { name: 'keys' })).toHaveTextContent('empty');
    });

    it('session sync stores cwd from the session entry', () => {
      function Test() {
        const { tabs } = useTabState();
        return (
          <span role="status" aria-label="cwd">
            {tabs.a?.cwd ?? 'undefined'}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />);
      setSessions([
        { channelId: 'a', state: 'idle', cwd: '/projects/app', projectRoot: '/projects/app' },
      ]);
      expect(screen.getByRole('status', { name: 'cwd' })).toHaveTextContent('/projects/app');
    });
  });

  describe('session mode (separates "spawn new" from "channel exists on server")', () => {
    it('tabs synced from server sessions do NOT request a new spawn', () => {
      function Test() {
        const { tabs } = useTabState();
        return (
          <span role="status" aria-label="flag">
            {String(tabs.a?.mode ?? 'missing')}
          </span>
        );
      }
      const { setSessions } = renderWithSessions(<Test />);
      setSessions([
        { channelId: 'a', state: 'idle', cwd: '/projects/app', projectRoot: '/projects/app' },
      ]);
      expect(screen.getByRole('status', { name: 'flag' })).toHaveTextContent('resume');
    });

    it('new tabs created via createNewTab spawn on mount', async () => {
      let createdId = '';
      function Test() {
        const { tabs } = useTabState();
        const actions = useTabActions();
        return (
          <>
            <button
              type="button"
              onClick={() => {
                createdId = actions.createNewTab({ cwd: '/x' }).channelId;
              }}
            >
              create
            </button>
            <span role="status" aria-label="flag">
              {createdId ? String(tabs[createdId]?.mode ?? 'missing') : '-'}
            </span>
          </>
        );
      }
      const { user } = renderWithSessions(<Test />);
      await user.click(screen.getByRole('button', { name: 'create' }));
      expect(screen.getByRole('status', { name: 'flag' })).toHaveTextContent('new');
    });
  });
});
