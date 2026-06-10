import type { PersistedLayout } from '@code-quest/schemas';
import {
  createFakeServer,
  createTestContainer,
  type LayoutStore,
  TYPES,
} from '@code-quest/server/test';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, useWorkspaceTab } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

const VALID_LAYOUT: PersistedLayout = {
  version: 2,
  tabs: [
    {
      id: 'tab-a',
      label: 'Tab A',
      paneRoot: {
        type: 'leaf',
        id: 'pane-a',
        content: { type: 'session', channelId: null, cwd: '/repo' },
      },
    },
    {
      id: 'tab-b',
      paneRoot: {
        type: 'leaf',
        id: 'pane-b',
        content: { type: 'git', target: { kind: 'fixed', cwd: '/repo' } },
      },
    },
  ],
  activeTabId: 'tab-b',
};

let wsProbe: ReturnType<typeof useWorkspaceTab> | null = null;

function TabInfo() {
  const ws = useWorkspaceTab();
  wsProbe = ws;
  return (
    <div>
      <span data-testid="tab-count">{ws.workspaceTabs.length}</span>
      <span data-testid="active-tab">{ws.activeWorkspaceTabId}</span>
    </div>
  );
}

function renderFull(summoner = createFakeSummoner()) {
  render(
    <SocketProvider socket={summoner.socket}>
      <AppConfigProvider>
        <TabProvider>
          <TabInfo />
        </TabProvider>
      </AppConfigProvider>
    </SocketProvider>,
  );
  return summoner;
}

function renderBare() {
  const summoner = createFakeSummoner();
  render(
    <SocketProvider socket={summoner.socket}>
      <TabProvider>
        <TabInfo />
      </TabProvider>
    </SocketProvider>,
  );
  return summoner;
}

async function emitSync(
  summoner: ReturnType<typeof createFakeSummoner>,
  layout: PersistedLayout,
  rev: number,
) {
  await act(async () => {
    summoner.socket.serverSocket.emit('layout:sync', { ...layout, rev });
  });
}

describe('app:init rehydrate', () => {
  it('rehydrates tabs when app:init ACK contains layout (applies incoming activeTabId)', async () => {
    const container = createTestContainer();
    // layout is stored per summoner — keyed by the provider identity
    const summonerKey = container.get<{ provider: string }>(TYPES.ChannelManager).provider;
    container.get<LayoutStore>(TYPES.LayoutStore).set(summonerKey, VALID_LAYOUT);
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());

    const summoner = createFakeSummoner(server);
    renderFull(summoner);

    // AppConfigProvider emits app:init on connect; wait for it to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId('tab-count').textContent).toBe('2');
    expect(screen.getByTestId('active-tab').textContent).toBe('tab-b');
  });

  it('keeps default single-tab state when app:init ACK layout is null', async () => {
    const server = createFakeServer();
    onTestFinished(() => server.destroy());

    const summoner = createFakeSummoner(server);
    renderFull(summoner);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId('tab-count').textContent).toBe('1');
  });
});

describe('layout:sync cross-device update', () => {
  it('updates workspace tabs when layout:sync event is received', async () => {
    const summoner = renderBare();

    await emitSync(summoner, VALID_LAYOUT, 1);

    expect(screen.getByTestId('tab-count').textContent).toBe('2');
    expect(screen.getByTestId('active-tab').textContent).toBe('tab-b');
  });

  it('ignores layout:sync with invalid schema', async () => {
    const summoner = renderBare();

    await act(async () => {
      summoner.socket.serverSocket.emit('layout:sync', { invalid: true });
    });

    expect(screen.getByTestId('tab-count').textContent).toBe('1');
  });

  it('ignores layout:sync with rev <= lastSeenRev (9.3)', async () => {
    const summoner = renderBare();

    await emitSync(summoner, VALID_LAYOUT, 2);
    expect(screen.getByTestId('tab-count').textContent).toBe('2');

    const threeTabs: PersistedLayout = {
      ...VALID_LAYOUT,
      tabs: [
        ...VALID_LAYOUT.tabs,
        {
          id: 'tab-c',
          paneRoot: {
            type: 'leaf',
            id: 'pane-c',
            content: { type: 'session', channelId: null, cwd: null },
          },
        },
      ],
    };

    // stale rev → ignored
    await emitSync(summoner, threeTabs, 1);
    expect(screen.getByTestId('tab-count').textContent).toBe('2');

    // newer rev → applied
    await emitSync(summoner, threeTabs, 3);
    expect(screen.getByTestId('tab-count').textContent).toBe('3');
  });

  it('preserves local active tab on sync (11.7)', async () => {
    const summoner = renderBare();

    // initial sync: local active (default tab) is not in incoming → fallback to incoming
    await emitSync(summoner, VALID_LAYOUT, 1);
    expect(screen.getByTestId('active-tab').textContent).toBe('tab-b');

    // user switches locally to tab-a
    act(() => wsProbe!.switchWorkspaceTab('tab-a'));
    expect(screen.getByTestId('active-tab').textContent).toBe('tab-a');

    // remote sync says active=tab-b — local view must NOT be stolen
    await emitSync(summoner, { ...VALID_LAYOUT, activeTabId: 'tab-b' }, 2);
    expect(screen.getByTestId('active-tab').textContent).toBe('tab-a');
  });

  it('falls back to the first tab when incoming activeTabId is not a member', async () => {
    const summoner = renderBare();

    await emitSync(summoner, { ...VALID_LAYOUT, activeTabId: 'ghost-tab' }, 1);

    expect(screen.getByTestId('tab-count').textContent).toBe('2');
    expect(screen.getByTestId('active-tab').textContent).toBe('tab-a');
  });

  it('dedupes duplicate channelIds on apply — only one leaf stays bound (11.5)', async () => {
    const summoner = renderBare();

    const dupLayout: PersistedLayout = {
      version: 2,
      tabs: [
        {
          id: 't1',
          paneRoot: {
            type: 'split',
            id: 's',
            direction: 'h',
            ratio: 0.5,
            first: {
              type: 'leaf',
              id: 'p1',
              content: { type: 'session', channelId: 'ch-1', cwd: '/a' },
            },
            second: {
              type: 'leaf',
              id: 'p2',
              content: { type: 'session', channelId: 'ch-1', cwd: '/a' },
            },
          },
        },
      ],
      activeTabId: 't1',
    };

    await emitSync(summoner, dupLayout, 1);

    const root = wsProbe!.workspaceTabs[0]!.paneRoot;
    if (root.type !== 'split') throw new Error('expected split');
    expect(root.first).toMatchObject({ content: { type: 'session', sessionId: 'ch-1' } });
    expect(root.second).toMatchObject({ content: { type: 'session', sessionId: null } });
  });
});

describe('debounced layout:save with echo guard', () => {
  it('does NOT echo layout:save after applying a sync (9.4)', async () => {
    vi.useFakeTimers();
    try {
      const summoner = renderBare();

      const emitted: unknown[] = [];
      summoner.socket.serverSocket.on('layout:save', (payload) => emitted.push(payload));

      await emitSync(summoner, VALID_LAYOUT, 1);

      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      expect(emitted).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('local state change emits layout:save after 500ms; unchanged state does not re-emit (9.5)', async () => {
    vi.useFakeTimers();
    try {
      const summoner = renderBare();

      const emitted: unknown[] = [];
      summoner.socket.serverSocket.on('layout:save', (payload) => emitted.push(payload));

      act(() => wsProbe!.addWorkspaceTab());

      expect(emitted).toHaveLength(0);
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(emitted).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces multiple rapid local changes to a single layout:save', async () => {
    vi.useFakeTimers();
    try {
      const summoner = renderBare();

      const emitted: unknown[] = [];
      summoner.socket.serverSocket.on('layout:save', () => emitted.push(true));

      act(() => wsProbe!.addWorkspaceTab());
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      act(() => wsProbe!.addWorkspaceTab());
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(emitted).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
