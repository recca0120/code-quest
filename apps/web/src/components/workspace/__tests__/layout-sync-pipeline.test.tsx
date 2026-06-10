/**
 * Layout sync 全管線整合測試（audit gap：兩個半邊接起來）。
 *
 * 慣例（fake-summoner-client skill）：client 與 server 都走真程式——
 * 真 UI（WorkspaceTabBar/PaneTree）＋ userEvent 驅動、真 layout:save handler
 * （rev 配發/broadcast），server push 用 claude.pushServerEvent。
 * 多層驗證：① UI ② summoner.sentEvents ③ container LayoutStore ④ DOM state attrs。
 */
import type { PersistedLayout } from '@code-quest/schemas';
import {
  createFakeServer,
  createTestContainer,
  type LayoutStore,
  TYPES,
} from '@code-quest/server/test';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, onTestFinished } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { PaneTree } from '@/components/workspace/PaneTree';
import { WorkspaceTabBar } from '@/components/workspace/WorkspaceTabBar';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import { GitProvider } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner, type FakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

/** debounce 是 500ms — negative 斷言（「不發生」）需要明確的真實時間窗 */
function settleDebounce() {
  return act(async () => {
    await new Promise((r) => setTimeout(r, 700));
  });
}

function renderClient(summoner: FakeSummoner) {
  return render(
    <SocketProvider socket={summoner.socket}>
      <AppConfigProvider>
        <ProjectProvider>
          <GitProvider>
            <TabProvider>
              <KeyboardShortcutsProvider>
                <WorkspaceTabBar />
                <PaneTree />
              </KeyboardShortcutsProvider>
            </TabProvider>
          </GitProvider>
        </ProjectProvider>
      </AppConfigProvider>
    </SocketProvider>,
  );
}

const TWO_LEAF_LAYOUT: PersistedLayout = {
  version: 2,
  tabs: [
    {
      id: 'tab-s',
      paneRoot: {
        type: 'split',
        id: 'split-1',
        direction: 'h',
        ratio: 0.5,
        first: {
          type: 'leaf',
          id: 'pane-x',
          content: { type: 'session', channelId: null, cwd: null },
        },
        second: {
          type: 'leaf',
          id: 'pane-y',
          content: { type: 'session', channelId: null, cwd: null },
        },
      },
    },
  ],
  activeTabId: 'tab-s',
};

describe('兩個 React client 經真 layout:save handler 同步', () => {
  it('A 新增 workspace tab → server 存檔＋廣播 → B 的 UI 更新；雙方皆無 echo', async () => {
    const user = userEvent.setup();

    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const a = createFakeSummoner(server);
    const b = createFakeSummoner(server);

    const viewA = renderClient(a);
    const viewB = renderClient(b);

    expect(within(viewB.container).getAllByTestId('workspace-tab')).toHaveLength(1);

    // ① A 從真 UI 新增 workspace tab
    await user.click(within(viewA.container).getByTestId('workspace-tab-add'));
    expect(within(viewA.container).getAllByTestId('workspace-tab')).toHaveLength(2);

    // debounce 500ms → 真 handler（配發 rev、broadcastAllExcept）→ B 的 UI 跟著更新
    await waitFor(
      () => expect(within(viewB.container).getAllByTestId('workspace-tab')).toHaveLength(2),
      { timeout: 2000 },
    );

    // ③ server store 確實存了 2 tabs（rev 1）
    const summonerKey = container.get<{ provider: string }>(TYPES.ChannelManager).provider;
    const stored = container.get<LayoutStore>(TYPES.LayoutStore).get(summonerKey);
    expect(stored?.rev).toBe(1);
    expect(stored?.layout.tabs).toHaveLength(2);

    // ② echo guard：B 套用 sync 後不回存；A 只存了那一次
    await settleDebounce();
    expect(b.sentEvents('layout:save')).toHaveLength(0);
    expect(a.sentEvents('layout:save')).toHaveLength(1);
  });
});

describe('save ack 的 rev 簿記（真 handler 配發）', () => {
  it('ack rev=1 後，假造的 rev:1 sync 被忽略、rev:2 才套用', async () => {
    const user = userEvent.setup();
    const summoner = createFakeSummoner(); // 內建真 createFakeServer

    renderClient(summoner);

    // UI 驅動變更 → debounce → 真 ack { ok:true, rev:1 }
    await user.click(screen.getByTestId('workspace-tab-add'));
    await waitFor(() => expect(summoner.sentEvents('layout:save')).toHaveLength(1), {
      timeout: 2000,
    });

    // 等值 rev 的 sync（帶可識別的 label）必須被忽略
    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', {
        ...TWO_LEAF_LAYOUT,
        tabs: [{ ...TWO_LEAF_LAYOUT.tabs[0]!, label: 'from-stale-sync' }],
        rev: 1,
      });
    });
    expect(screen.queryByText('from-stale-sync')).not.toBeInTheDocument();

    // 更新的 rev 才套用
    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', {
        ...TWO_LEAF_LAYOUT,
        tabs: [{ ...TWO_LEAF_LAYOUT.tabs[0]!, label: 'from-new-sync' }],
        rev: 2,
      });
    });
    expect(screen.getByText('from-new-sync')).toBeInTheDocument();
  });
});

describe('sync 保留 focused/zoomed view state（spec: Sync preserves local view state）', () => {
  it('zoom 中收到同結構 sync → 維持 zoom；pane 被移除 → 解除並 fallback focus', async () => {
    const user = userEvent.setup();
    const summoner = createFakeSummoner();
    const { container } = renderClient(summoner);

    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', { ...TWO_LEAF_LAYOUT, rev: 1 });
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);

    // 點 pane-y 取得 focus → ⌘⇧Z zoom（solo rendering：只剩 pane-y、無 divider）
    const paneY = container.querySelector('[data-pane-id="pane-y"]') as HTMLElement;
    await user.click(paneY);
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    expect(screen.getAllByTestId('split-pane-leaf')[0]!.dataset.paneId).toBe('pane-y');
    expect(screen.queryByTestId('pane-divider')).not.toBeInTheDocument();

    // 同結構 sync（label 改）→ zoom/focus 不被遠端踢出
    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', {
        ...TWO_LEAF_LAYOUT,
        tabs: [{ ...TWO_LEAF_LAYOUT.tabs[0]!, label: 'renamed' }],
        rev: 2,
      });
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    expect(screen.getAllByTestId('split-pane-leaf')[0]!.dataset.paneId).toBe('pane-y');

    // pane-y 被 incoming 移除 → zoom 解除、focus fallback 到剩下的 leaf
    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', {
        version: 2,
        tabs: [
          {
            id: 'tab-s',
            paneRoot: {
              type: 'leaf',
              id: 'pane-x',
              content: { type: 'session', channelId: null, cwd: null },
            },
          },
        ],
        activeTabId: 'tab-s',
        rev: 3,
      });
    });
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.dataset.paneId).toBe('pane-x');
    // focused fallback 到 firstLeafId → toolbar 帶 data-focused
    expect(screen.getByTestId('pane-header').dataset.focused).toBe('true');
  });
});

describe('echo guard 以「套用後狀態」比對（keepLocalActive 分歧路徑）', () => {
  it('本地保留 active tab 使 applied ≠ incoming 時，仍不回 echo', async () => {
    const user = userEvent.setup();
    const summoner = createFakeSummoner();

    renderClient(summoner);

    const twoTabs: PersistedLayout = {
      version: 2,
      tabs: [
        {
          id: 'tab-a',
          label: 'Alpha',
          paneRoot: {
            type: 'leaf',
            id: 'pa',
            content: { type: 'session', channelId: null, cwd: null },
          },
        },
        {
          id: 'tab-b',
          label: 'Beta',
          paneRoot: {
            type: 'leaf',
            id: 'pb',
            content: { type: 'session', channelId: null, cwd: null },
          },
        },
      ],
      activeTabId: 'tab-b',
    };
    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', { ...twoTabs, rev: 1 });
    });

    // sync 已套用：Beta 是 active
    expect(screen.getByText('Beta').closest('[data-testid="workspace-tab"]')).toHaveAttribute(
      'data-active',
    );

    // 本地切到 Alpha（點 tab 本體——label 是 rename 用的內層 button，會 stopPropagation）
    await user.click(screen.getAllByTestId('workspace-tab')[0]!);
    expect(screen.getByText('Alpha').closest('[data-testid="workspace-tab"]')).toHaveAttribute(
      'data-active',
    );
    await waitFor(() => expect(summoner.sentEvents('layout:save')).toHaveLength(1), {
      timeout: 2000,
    });

    // incoming 指定 active=tab-b，本地保留 Alpha → applied ≠ incoming。
    // 若 lastAppliedJson 被改成快取 incoming payload，這裡就會多一次 save。
    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', { ...twoTabs, rev: 5 });
    });
    await settleDebounce();
    expect(summoner.sentEvents('layout:save')).toHaveLength(1);
    expect(screen.getByText('Alpha').closest('[data-testid="workspace-tab"]')).toHaveAttribute(
      'data-active',
    );
  });
});

describe('defensive sync payloads（wiring 層，非純函式）', () => {
  it('無 version 的 v1 payload 經 migration 正常套用', async () => {
    const summoner = createFakeSummoner();
    renderClient(summoner);

    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', {
        tabs: [
          {
            id: 'v1-a',
            label: 'Legacy',
            paneRoot: { type: 'leaf', id: 'p1', content: { type: 'session', cwd: '/old' } },
          },
          {
            id: 'v1-b',
            paneRoot: { type: 'leaf', id: 'p2', content: { type: 'git', cwd: '/old' } },
          },
        ],
        activeTabId: 'v1-b',
      });
    });

    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(2);
    expect(screen.getByText('Legacy')).toBeInTheDocument();
  });

  it('空 tabs 的 sync 不得清空 workspace', async () => {
    const summoner = createFakeSummoner();
    renderClient(summoner);

    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', { ...TWO_LEAF_LAYOUT, rev: 1 });
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);

    await act(async () => {
      summoner.claude().pushServerEvent('layout:sync', {
        version: 2,
        tabs: [],
        activeTabId: '',
        rev: 2,
      });
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
  });
});
describe('reconnect 的 app:init replay（spec: activeTabId 僅初次套用）', () => {
  it('重連後的 init replay 不偷本地 active tab', async () => {
    const user = userEvent.setup();
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());

    // 另一個 client 預存 layout（rev 1，active = Beta）
    const seeder = createFakeSummoner(server).claude();
    const twoTabs: PersistedLayout = {
      version: 2,
      tabs: [
        {
          id: 'tab-a',
          label: 'Alpha',
          paneRoot: {
            type: 'leaf',
            id: 'pa',
            content: { type: 'session', channelId: null, cwd: null },
          },
        },
        {
          id: 'tab-b',
          label: 'Beta',
          paneRoot: {
            type: 'leaf',
            id: 'pb',
            content: { type: 'session', channelId: null, cwd: null },
          },
        },
      ],
      activeTabId: 'tab-b',
    };
    await seeder.send('layout:save', twoTabs);

    const summoner = createFakeSummoner(server);
    renderClient(summoner);

    // 首次 init：套用 incoming activeTabId（Beta）
    await waitFor(() =>
      expect(screen.getByText('Beta').closest('[data-testid="workspace-tab"]')).toHaveAttribute(
        'data-active',
      ),
    );

    // 本地切到 Alpha 並讓 debounce 存檔
    await user.click(screen.getAllByTestId('workspace-tab')[0]!);
    await waitFor(() => expect(summoner.sentEvents('layout:save')).toHaveLength(1), {
      timeout: 2000,
    });

    // 另一個 client 再存一版 active=Beta（rev 3）——store 與本地 view 分歧
    await act(async () => {
      await seeder.send('layout:save', twoTabs);
    });

    // 重連 → app:init replay 帶回 store 的 layout（active=Beta）
    const initsBefore = summoner.sentEvents('app:init').length;
    await act(async () => {
      summoner.socket.disconnect();
      summoner.socket.connect();
    });
    await waitFor(() =>
      expect(summoner.sentEvents('app:init').length).toBeGreaterThan(initsBefore),
    );

    // 非首次 init 走 sync 語意：本地 active（Alpha）不被偷
    expect(screen.getByText('Alpha').closest('[data-testid="workspace-tab"]')).toHaveAttribute(
      'data-active',
    );
  });
});
describe('reload 後 live session 重綁（spec: live session rebinds across reload）', () => {
  it('layout 還原綁回仍存活的 channel：resume join、不 spawn 第二個 process', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());

    // 第一個「視窗」：開 project、launch session、等 layout 存檔
    const s1 = createFakeSummoner(server);
    const view1 = await renderWithWorkspace({ summoner: s1 });
    const project = await view1.addProject();
    await project.launchSession();
    expect(s1.sentEvents('session:launch')).toHaveLength(1);
    await waitFor(() => expect(s1.sentEvents('layout:save').length).toBeGreaterThan(0), {
      timeout: 2000,
    });
    view1.unmount();

    // 「reload」：新 client 連同一 server——app:init 帶回 layout（含 channelId）＋ alive sessions
    const s2 = createFakeSummoner(server);
    await renderWithWorkspace({ summoner: s2 });

    // ① UI：chat pane 自動重綁出現
    await waitFor(() => expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument(), {
      timeout: 2000,
    });

    // ② socket：走 resume join，絕不 spawn 第二次
    expect(s2.sentEvents('session:launch')).toHaveLength(0);
    await waitFor(() => expect(s2.sentEvents('session:join').length).toBeGreaterThan(0));

    // ③ server：channel 數維持 1（沒有第二個 process）
    const manager = container.get<{ getAliveChannels(): unknown[] }>(TYPES.ChannelManager);
    expect(manager.getAliveChannels()).toHaveLength(1);
  });
});
