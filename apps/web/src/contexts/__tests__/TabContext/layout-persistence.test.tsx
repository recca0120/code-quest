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
  tabs: [
    {
      id: 'tab-a',
      label: 'Tab A',
      paneRoot: { type: 'leaf', id: 'pane-a', content: { type: 'session', cwd: '/repo' } },
    },
    {
      id: 'tab-b',
      paneRoot: { type: 'leaf', id: 'pane-b', content: { type: 'git', cwd: '/repo' } },
    },
  ],
  activeTabId: 'tab-b',
};

function TabInfo() {
  const { workspaceTabs, activeWorkspaceTabId } = useWorkspaceTab();
  return (
    <div>
      <span data-testid="tab-count">{workspaceTabs.length}</span>
      <span data-testid="active-tab">{activeWorkspaceTabId}</span>
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

describe('app:init rehydrate', () => {
  it('rehydrates tabs when app:init ACK contains layout', async () => {
    const container = createTestContainer();
    container.get<LayoutStore>(TYPES.LayoutStore).set('default', VALID_LAYOUT);
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
    // No layout seeded → LayoutStore returns null → default state
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
    const summoner = createFakeSummoner();
    render(
      <SocketProvider socket={summoner.socket}>
        <TabProvider>
          <TabInfo />
        </TabProvider>
      </SocketProvider>,
    );

    await act(async () => {
      summoner.socket.serverSocket.emit('layout:sync', VALID_LAYOUT);
    });

    expect(screen.getByTestId('tab-count').textContent).toBe('2');
    expect(screen.getByTestId('active-tab').textContent).toBe('tab-b');
  });

  it('ignores layout:sync with invalid schema', async () => {
    const summoner = createFakeSummoner();
    render(
      <SocketProvider socket={summoner.socket}>
        <TabProvider>
          <TabInfo />
        </TabProvider>
      </SocketProvider>,
    );

    await act(async () => {
      summoner.socket.serverSocket.emit('layout:sync', { invalid: true });
    });

    // Default = 1 tab
    expect(screen.getByTestId('tab-count').textContent).toBe('1');
  });
});

describe('debounced layout:save', () => {
  it('emits layout:save 500ms after workspace tab state changes via layout:sync', async () => {
    vi.useFakeTimers();
    try {
      const summoner = createFakeSummoner();
      render(
        <SocketProvider socket={summoner.socket}>
          <TabProvider>
            <TabInfo />
          </TabProvider>
        </SocketProvider>,
      );

      const emitted: unknown[] = [];
      summoner.socket.serverSocket.on('layout:save', (payload) => emitted.push(payload));

      // Trigger a state change by receiving a layout:sync
      await act(async () => {
        summoner.socket.serverSocket.emit('layout:sync', VALID_LAYOUT);
      });

      expect(emitted).toHaveLength(0);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(emitted.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces multiple rapid state changes to a single layout:save', async () => {
    vi.useFakeTimers();
    try {
      const summoner = createFakeSummoner();
      render(
        <SocketProvider socket={summoner.socket}>
          <TabProvider>
            <TabInfo />
          </TabProvider>
        </SocketProvider>,
      );

      const emitted: unknown[] = [];
      summoner.socket.serverSocket.on('layout:save', () => emitted.push(true));

      const layoutA: PersistedLayout = {
        tabs: [
          {
            id: 'a',
            paneRoot: { type: 'leaf', id: 'pa', content: { type: 'session', cwd: null } },
          },
        ],
        activeTabId: 'a',
      };
      const layoutB: PersistedLayout = {
        tabs: [
          {
            id: 'b',
            paneRoot: { type: 'leaf', id: 'pb', content: { type: 'session', cwd: null } },
          },
        ],
        activeTabId: 'b',
      };

      await act(async () => {
        summoner.socket.serverSocket.emit('layout:sync', layoutA);
      });
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      await act(async () => {
        summoner.socket.serverSocket.emit('layout:sync', layoutB);
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(emitted).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
