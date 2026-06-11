/**
 * Group 9: Phase 1 integration test
 * Full flow: workspace tab management + split pane + session assignment + zoom
 *
 * 慣例（fake-summoner-client skill）：renderWithWorkspace 全真 provider stack
 * ＋ createFakeSummoner（真 createFakeServer/container，無 vi.mock），驅動全走真 UI——
 * session assignment 走 PanePicker（唯一內容入口）、add tab 用 workspace-tab-add、
 * tab 切換用 click workspace-tab、split 用 pane header 的 pane-split-h、
 * focus 用 click leaf、zoom/unzoom 用 ⌘⇧Z。
 * 多層驗證：① UI 反射 ② summoner.sentEvents ③ server ChannelManager。
 *
 * 註：真 workspace 的 pristine 狀態（零 session＋預設 layout）渲染全域
 * EmptyState（無 tab bar）——「1 tab／1 pane」的初始斷言改在首個 session
 * launch 後驗證（layout chrome 此時才出現）。
 */
import { createFakeServer, createTestContainer, TYPES } from '@code-quest/server/test';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { emitAssistantTurn, sendUserMessage } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('Phase 1 integration (9.1)', () => {
  it('full flow: workspace tab + split pane + session assignment + zoom', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);

    const { claude, user, addProject } = await renderWithWorkspace({ summoner });
    const project = await addProject();

    // Pristine 狀態：全域 EmptyState（layout chrome 尚未出現）
    expect(screen.getByText('No open sessions')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-tab')).not.toBeInTheDocument();

    // ── Session assignment（真 PanePicker 管線：New Session → chat 卡 → session:launch）
    const channelId = await project.launchSession();
    expect(channelId).not.toBe('');
    // ② socket 層：恰好一次真 launch RPC
    expect(summoner.sentEvents('session:launch')).toHaveLength(1);
    // ③ server 層：恰好一個 alive channel
    const manager = container.get<{ getAliveChannels(): unknown[] }>(TYPES.ChannelManager);
    expect(manager.getAliveChannels()).toHaveLength(1);

    // Initial layout: 1 workspace tab、1 pane、無 zoom
    expect(screen.getAllByTestId('workspace-tab')).toHaveLength(1);
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    expect(screen.queryByTestId('zoom-bar')).not.toBeInTheDocument();

    // ① UI 反射 focused leaf 的 content.sessionId：launch 後 leaf 掛上該 channel 的
    //    chat（content.sessionId 解析到 live session meta 才會渲染 TabContent），
    //    且該 channel 的 assistant 訊息（真 pipeline）出現在這個 leaf 裡
    const sessionLeaf = screen.getByTestId('split-pane-leaf');
    expect(sessionLeaf).toHaveAttribute('data-focused');
    expect(within(sessionLeaf).getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    await sendUserMessage(user, 'phase1 ping');
    await emitAssistantTurn(claude, 'phase1-session-bound');
    expect(within(sessionLeaf).getByText('phase1-session-bound')).toBeInTheDocument();
    const sessionLeafId = sessionLeaf.dataset.paneId;

    // ── Add workspace tab（真 UI：workspace-tab-add）→ 新 tab 變 active、帶自己的空 pane
    await user.click(screen.getByTestId('workspace-tab-add'));
    const wsTabs = screen.getAllByTestId('workspace-tab');
    expect(wsTabs).toHaveLength(2);
    expect(wsTabs[1]).toHaveAttribute('data-active');
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    expect(screen.getByTestId('empty-pane')).toBeInTheDocument();

    // ── 切回第一個 workspace tab（真 UI：click tab 本體）→ session leaf 還在
    await user.click(screen.getAllByTestId('workspace-tab')[0]!);
    expect(screen.getAllByTestId('workspace-tab')[0]).toHaveAttribute('data-active');
    expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(sessionLeafId);

    // ── Split（真 UI：pane header 的 pane-split-h）→ 2 leaves，focus 移到新空 leaf
    await user.click(screen.getByTestId('pane-split-h'));
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(2);
    expect(leaves[0]!.dataset.paneId).toBe(sessionLeafId);
    // session 留在原 leaf；新 leaf 是空 pane 且取得 focus
    expect(within(leaves[0]!).getByText('phase1-session-bound')).toBeInTheDocument();
    expect(within(leaves[1]!).getByTestId('empty-pane')).toBeInTheDocument();
    expect(leaves[1]).toHaveAttribute('data-focused');
    expect(leaves[0]).not.toHaveAttribute('data-focused');

    // ── Focus（真 UI：click leaf）→ focus 回到 session leaf
    await user.click(leaves[0]!);
    expect(leaves[0]).toHaveAttribute('data-focused');
    expect(leaves[1]).not.toHaveAttribute('data-focused');

    // ── Zoom focused pane（⌘⇧Z，KeyboardShortcutsProvider）
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
    expect(screen.getByTestId('zoom-bar')).toHaveTextContent(/pane ①/);
    // Solo rendering: only the zoomed leaf stays in the DOM (fills the root)
    const zoomed = screen.getAllByTestId('split-pane-leaf');
    expect(zoomed).toHaveLength(1);
    expect(zoomed[0]!.dataset.paneId).toBe(sessionLeafId);
    expect(screen.queryByTestId('pane-divider')).not.toBeInTheDocument();
    // zoomed leaf 仍掛著 session 內容
    expect(within(zoomed[0]!).getByText('phase1-session-bound')).toBeInTheDocument();

    // ── Unzoom（⌘⇧Z toggle）→ 回到 2-pane 分割
    await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
    expect(screen.queryByTestId('zoom-bar')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
  });
});
