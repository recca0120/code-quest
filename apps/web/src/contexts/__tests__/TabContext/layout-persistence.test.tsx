/**
 * Layout persistence — TabProvider 端的 init/remount/防呆/debounce 行為。
 *
 * 與 layout-sync-pipeline.test.tsx 分工：echo guard（9.4）、save ack rev 簿記與
 * stale sync 忽略（9.3）、preserve local active（11.7）、跨裝置雙 client 同步
 * 已在彼處以真 UI + 真 layout:save handler 覆蓋，本檔不重複。
 *
 * 慣例（fake-summoner-client skill）：真 WorkspaceTabBar 切片 + userEvent 驅動；
 * 跨裝置寫入走 seeder client 的真 layout:save handler（配 rev、broadcast）；
 * 只有 schema-invalid / defensive payload 保留 claude.pushServerEvent。
 */
import type { PersistedLayout } from '@code-quest/schemas';
import {
  createFakeServer,
  createTestContainer,
  type LayoutStore,
  seedLayout,
  TYPES,
} from '@code-quest/server/test';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, onTestFinished } from 'vitest';
import { WorkspaceTabBar } from '@/components/workspace/WorkspaceTabBar';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import { GitProvider } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, useWorkspaceTab } from '@/contexts/TabContext';
import { createFakeSummoner, type FakeSummoner } from '@/test/fake-summoner';

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

const THREE_TAB_LAYOUT: PersistedLayout = {
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

/** 純 assertion 用 state probe（不做驅動）— pane tree 形狀無法只靠 tab bar DOM 驗 */
let wsProbe: ReturnType<typeof useWorkspaceTab> | null = null;

function WorkspaceStateProbe() {
  wsProbe = useWorkspaceTab();
  return null;
}

/** debounce 是 500ms — negative 斷言（「不發生」）需要明確的真實時間窗 */
function settleDebounce() {
  return act(async () => {
    await new Promise((r) => setTimeout(r, 700));
  });
}

function renderClient(summoner: FakeSummoner, extra?: React.ReactNode) {
  return render(
    <SocketProvider socket={summoner.socket}>
      <ProjectProvider>
        <GitProvider>
          <AppConfigProvider>
            <TabProvider>
              <WorkspaceTabBar />
              {extra}
            </TabProvider>
          </AppConfigProvider>
        </GitProvider>
      </ProjectProvider>
    </SocketProvider>,
  );
}

describe('app:init rehydrate', () => {
  it('rehydrates tabs when app:init ACK contains layout (applies incoming activeTabId)', async () => {
    const container = createTestContainer();
    seedLayout(container, VALID_LAYOUT);
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());

    renderClient(createFakeSummoner(server));

    // AppConfigProvider emits app:init on connect — wait for the rehydrate to land
    await waitFor(() => expect(screen.getAllByTestId('workspace-tab')).toHaveLength(2));
    const tabs = screen.getAllByTestId('workspace-tab');
    expect(tabs[0]).toHaveTextContent('Tab A');
    // incoming activeTabId=tab-b → 第二個 tab 是 active
    expect(tabs[1]).toHaveAttribute('data-active');
    expect(tabs[0]).not.toHaveAttribute('data-active');
  });

  it('keeps default single-tab state when app:init ACK layout is null', async () => {
    const server = createFakeServer();
    onTestFinished(() => server.destroy());

    const summoner = createFakeSummoner(server);
    renderClient(summoner);

    await waitFor(() => expect(summoner.sentEvents('app:init')).toHaveLength(1));
    await act(async () => {});
    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(1);
  });
});

describe('provider remount replay (client-structure-cleanup 4.1)', () => {
  it('a remounted TabProvider must not apply a stale init snapshot over a newer synced layout', async () => {
    const container = createTestContainer();
    seedLayout(container, VALID_LAYOUT); // rev 1
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);

    function Harness({ mounted }: { mounted: boolean }) {
      return (
        <SocketProvider socket={summoner.socket}>
          <ProjectProvider>
            <GitProvider>
              <AppConfigProvider>
                {mounted && (
                  <TabProvider>
                    <WorkspaceTabBar />
                  </TabProvider>
                )}
              </AppConfigProvider>
            </GitProvider>
          </ProjectProvider>
        </SocketProvider>
      );
    }

    const { rerender } = render(<Harness mounted />);
    await waitFor(() => expect(screen.getAllByTestId('workspace-tab')).toHaveLength(2));

    // 另一個裝置存了 3-tab 版本 — 真 handler 配 rev 2 並 broadcast layout:sync
    const seeder = createFakeSummoner(server).claude();
    await act(async () => {
      await seeder.send('layout:save', THREE_TAB_LAYOUT);
    });
    await waitFor(() => expect(screen.getAllByTestId('workspace-tab')).toHaveLength(3));

    // unmount + remount the TabProvider (e.g. last project removed then re-added)
    rerender(<Harness mounted={false} />);
    rerender(<Harness mounted />);

    // replayed init snapshot must reflect the newer layout, not the stale rev-1 one
    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(3);
  });
});

describe('layout:sync 防呆與 LWW 套用細節', () => {
  it('ignores layout:sync with invalid schema — listener stays alive for later valid syncs', async () => {
    const summoner = createFakeSummoner();
    renderClient(summoner);

    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', { invalid: true });
    });
    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(1);

    // 後續合法 sync 正常套用 — 證明上面是「擋掉」而不是「沒接 listener」
    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', { ...VALID_LAYOUT, rev: 1 });
    });
    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(2);
  });

  it('falls back to the first tab when incoming activeTabId is not a member', async () => {
    const server = createFakeServer();
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    renderClient(summoner);

    // 另一個裝置存了 activeTabId 指向不存在 tab 的 layout（schema 不驗 membership，
    // 真 handler 照存照廣播）→ client 端 membership guard 必須 clamp 到第一個 tab
    const seeder = createFakeSummoner(server).claude();
    await act(async () => {
      await seeder.send('layout:save', { ...VALID_LAYOUT, activeTabId: 'ghost-tab' });
    });

    await waitFor(() => expect(screen.getAllByTestId('workspace-tab')).toHaveLength(2));
    const tabs = screen.getAllByTestId('workspace-tab');
    expect(tabs[0]).toHaveAttribute('data-active');
    expect(tabs[1]).not.toHaveAttribute('data-active');
  });

  it('dedupes duplicate channelIds on apply — only one leaf stays bound (11.5)', async () => {
    // defensive payload：真 server 的 layout:save 已在 wire boundary dedupe，
    // 這裡測的是 client 端 applyLayout 自己的防線 → 保留 pushServerEvent
    const summoner = createFakeSummoner();
    renderClient(summoner, <WorkspaceStateProbe />);

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

    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', { ...dupLayout, rev: 1 });
    });

    const root = wsProbe!.workspaceTabs[0]!.paneRoot;
    if (root.type !== 'split') throw new Error('expected split');
    expect(root.first).toMatchObject({ content: { type: 'session', sessionId: 'ch-1' } });
    expect(root.second).toMatchObject({ content: { type: 'session', sessionId: null } });
  });
});

describe('debounced layout:save', () => {
  it('debounces multiple rapid local changes to a single layout:save (real handler stores merged result)', async () => {
    const user = userEvent.setup();
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    renderClient(summoner);

    // 兩個 debounce 窗內的真 UI 變更
    await user.click(screen.getByTestId('workspace-tab-add'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    await user.click(screen.getByTestId('workspace-tab-add'));
    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(3);
    // 第二個變更重置了 timer — 此刻尚未送出
    expect(summoner.sentEvents('layout:save')).toHaveLength(0);

    await settleDebounce();
    // ② socket：合併成單一 save
    expect(summoner.sentEvents('layout:save')).toHaveLength(1);

    // ③ server store：真 handler 存下合併後的 3 tabs（rev 1 — 只配發過一次）
    const summonerKey = container.get<{ provider: string }>(TYPES.ChannelManager).provider;
    const stored = container.get<LayoutStore>(TYPES.LayoutStore).get(summonerKey);
    expect(stored?.rev).toBe(1);
    expect(stored?.layout.tabs).toHaveLength(3);
  });
});
