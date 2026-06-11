import type { SessionStateSummary } from '@code-quest/schemas';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { NavigationIntentBridge } from '@/components/workspace/NavigationIntentBridge';
import { PaneTree } from '@/components/workspace/PaneTree';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';
import { useNavigationActions, useNavigationState } from '@/contexts/NavigationContext';
import { useSession } from '@/contexts/SessionContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, useTabActions, useTabState } from '@/contexts/TabContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { setupMatchMedia } from '@/test/fake-match-media';
import { createFakeSummoner, type FakeSummoner } from '@/test/fake-summoner';

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

describe('TabProvider', () => {
  /**
   * pendingActivateChannel intent（Decision 10）— 真 UI 管線版。
   *
   * 驅動：requestActivateChannel 直呼（fake-summoner-client skill 例外，註明——
   * requestActivateChannel 是 NavigationContext 的公開 action、即受測 API；原
   * production 載體 WorktreeSessionList 已刪除（孤檔清理），現存載體
   * （WorktreeChildList 的 resume dialog／ProjectCard）需整套 git+resume pipeline，
   * 與 intent 消費語意無關）。sessions 不用 rerender props 餵，改經真
   * SessionProvider 由 claude.pushServerEvent('session:states'/'session:dead')
   * 流入（bridge 鏡像 Workspace.tsx 的 useSession().sessions → TabProvider 接線），
   * ActivateDriver 的按鈕也由真 sessions 派生（session row 語意）。
   * activation 的 DOM 表徵：真 PaneTree（placeExistingSession → focused
   * pane-header 顯示 title）＋ ⌘⇧M SessionManager（KeyboardShortcutsProvider）。
   * Probe 僅讀 state（activeTabId / pendingActivateChannel），不做受測驅動。
   */
  describe('pendingActivateChannel intent (Decision 10)', () => {
    function Probe() {
      const { activeTabId } = useTabState();
      const { pendingActivateChannel } = useNavigationState();
      return (
        <>
          <span role="status" aria-label="active">
            {activeTabId ?? 'null'}
          </span>
          <span role="status" aria-label="pending">
            {JSON.stringify(pendingActivateChannel)}
          </span>
        </>
      );
    }

    const activeText = () => screen.getByRole('status', { name: 'active' }).textContent;
    const pendingText = () => screen.getByRole('status', { name: 'pending' }).textContent;

    /** 鏡像 Workspace.tsx 的接線：TabProvider 的 sessions 來自真 SessionProvider。 */
    function TabProviderBridge({ cwd, children }: { cwd: string; children: ReactNode }) {
      const { sessions } = useSession();
      return (
        <TabProvider sessions={sessions} cwd={cwd}>
          {children}
        </TabProvider>
      );
    }

    /** intent 驅動（受測 API 直呼——skill 例外，理由見上方 doc comment）：
     *  按鈕由真 SessionProvider 的 sessions 派生（≒ session row），點擊呼叫
     *  NavigationContext 公開 action requestActivateChannel。 */
    function ActivateDriver() {
      const { sessions } = useSession();
      const { requestActivateChannel } = useNavigationActions();
      return (
        <>
          {sessions
            .filter((s) => s.state !== 'exited')
            .map((s) => (
              <button
                key={s.channelId}
                type="button"
                onClick={() => requestActivateChannel(s.channelId)}
              >
                {`Activate: ${s.title ?? s.channelId.slice(0, 8)}`}
              </button>
            ))}
        </>
      );
    }

    async function renderHarness(opts: { tabProviderCwd: string }) {
      setupMatchMedia(1280); // desktop：pane toolbar / manager 為桌面版佈局
      const { summoner, Wrapper } = createTestWrapper();
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(
        <Wrapper>
          {/* CommandPaletteProvider：App.tsx 同位置（ChatView 的 MessageList 需要） */}
          <CommandPaletteProvider>
            <TabProviderBridge cwd={opts.tabProviderCwd}>
              <NavigationIntentBridge />
              <KeyboardShortcutsProvider>
                <PaneTree />
              </KeyboardShortcutsProvider>
              <ActivateDriver />
              <Probe />
            </TabProviderBridge>
          </CommandPaletteProvider>
        </Wrapper>,
      );
      // app:init replay 會 wholesale setSessions —— 先 settle 再 push（同 production 順序）
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(summoner.sentEvents('app:init')).toHaveLength(1);
      return { claude: summoner.claude(), user };
    }

    function pushStates(
      claude: ReturnType<FakeSummoner['claude']>,
      sessions: SessionStateSummary[],
    ) {
      return act(async () => {
        claude.pushServerEvent('session:states', { sessions });
      });
    }

    it('channel already in tabs → 點 session 的 activate 即 activate＋清除 pending，session 落入 pane', async () => {
      const { claude, user } = await renderHarness({ tabProviderCwd: '/proj' });

      await pushStates(claude, [
        {
          channelId: 'ch-1',
          state: 'idle',
          cwd: '/proj',
          projectRoot: '/proj',
          title: 'One',
          branch: 'feat/one',
        },
      ]);

      // arrange 完成：sessions diff 已建 tab（首個 tab 自動 active），但尚未置入 pane
      expect(activeText()).toBe('ch-1');
      expect(screen.getByTestId('empty-pane')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Activate: One' }));

      await waitFor(() => {
        expect(activeText()).toBe('ch-1');
        expect(pendingText()).toBe('null');
      });

      // DOM 表徵：placeExistingSession 把 session 放進 focused pane，toolbar 顯示
      // session 的 branch（title 由 CLI 管線稍後才回填，diff addTab 只帶 branch/cwd）
      await waitFor(() => {
        const header = screen.getByTestId('pane-header');
        expect(header.dataset.focused).toBe('true');
        expect(header.textContent).toContain('⎇ feat/one');
      });
      expect(screen.queryByTestId('empty-pane')).not.toBeInTheDocument();

      // ⌘⇧M SessionManager：activated session 列為 item；點 item 後 manager 關閉、
      // session 仍在 focused pane（item 走 setSessionInPane 的「show here」語意）
      await user.keyboard('{Meta>}{Shift>}M{/Shift}{/Meta}');
      expect(screen.getByTestId('session-manager')).toBeInTheDocument();
      await user.click(screen.getByTestId('session-manager-item-ch-1'));
      expect(screen.queryByTestId('session-manager')).not.toBeInTheDocument();
      expect(screen.getByTestId('pane-header').dataset.focused).toBe('true');
    });

    it('channel NOT yet in tabs（disconnected row）→ pending 等待不清除，session 復活才 activate', async () => {
      const { claude, user } = await renderHarness({ tabProviderCwd: '/proj' });

      // disconnected session：driver 仍列按鈕（只濾 exited），但 TERMINAL_STATES
      // 使 sessions diff 不建 tab —— intent 目標「不在 tabs」的真實場景
      await pushStates(claude, [
        {
          channelId: 'ch-late',
          state: 'disconnected',
          cwd: '/proj',
          projectRoot: '/proj',
          title: 'Late',
        },
      ]);
      expect(activeText()).toBe('null');

      await user.click(screen.getByRole('button', { name: 'Activate: Late' }));

      // Decision 10：wait（no clear）——pending 保持、不 activate
      expect(pendingText()).toContain('"channelId":"ch-late"');
      expect(activeText()).toBe('null');
      expect(screen.getByTestId('empty-pane')).toBeInTheDocument();

      // session 死透（diff 以 channelId 記帳——須先 removed 之後同 id 才算 added）
      await act(async () => {
        claude.pushServerEvent('session:dead', { channelId: 'ch-late' });
      });
      expect(pendingText()).toContain('"channelId":"ch-late"'); // intent 仍在等

      // 再以 idle 重新上線 → tab 出現 → bridge 消費 intent
      await pushStates(claude, [
        {
          channelId: 'ch-late',
          state: 'idle',
          cwd: '/proj',
          projectRoot: '/proj',
          title: 'Late',
          branch: 'feat/late',
        },
      ]);

      await waitFor(() => {
        expect(activeText()).toBe('ch-late');
        expect(pendingText()).toBe('null');
      });
      const header = screen.getByTestId('pane-header');
      expect(header.dataset.focused).toBe('true');
      expect(header.textContent).toContain('⎇ feat/late');
    });

    it('global TabProvider：provider cwd 與 session cwd 不同也照樣 activate（Decision 4 無 cwd guard）', async () => {
      // 全域 TabProvider 掛在 /proj，被點的 sessions 屬於 /other 的 worktree
      const { claude, user } = await renderHarness({ tabProviderCwd: '/proj' });

      await pushStates(claude, [
        {
          channelId: 'ch-a',
          state: 'idle',
          cwd: '/other/wt',
          projectRoot: '/other',
          title: 'Alpha',
          branch: 'feat/alpha',
        },
        {
          channelId: 'ch-target',
          state: 'idle',
          cwd: '/other/wt',
          projectRoot: '/other',
          title: 'Target',
          branch: 'feat/target',
        },
      ]);
      // 首個 session 自動成為 active tab —— 點擊後必須切換才證明 intent 被消費
      expect(activeText()).toBe('ch-a');

      await user.click(screen.getByRole('button', { name: 'Activate: Target' }));

      await waitFor(() => {
        expect(activeText()).toBe('ch-target');
        expect(pendingText()).toBe('null');
      });
      const header = screen.getByTestId('pane-header');
      expect(header.dataset.focused).toBe('true');
      expect(header.textContent).toContain('⎇ feat/target');
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
            <TabProvider>
              <NavigationIntentBridge />
              {children}
            </TabProvider>
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
            <TabProvider>
              <NavigationIntentBridge />
              {children}
            </TabProvider>
          </SocketProvider>
        ),
      });
      expect(result.current).not.toHaveProperty('splitTabId');
    });
  });
});
