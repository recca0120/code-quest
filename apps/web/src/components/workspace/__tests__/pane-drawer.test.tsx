/**
 * P3b Drawer＋rail 升級（tmux-workspace-ui；spec: drawer-pin / chat-tool-rail）
 * - 全域單例 drawer：rail ⤢ 開、esc／遮罩關
 * - 「⊞ 釘選成 pane」：descriptor → focused pane 右側 split、drawer 關、layout 存檔
 * - rail「⊞ 升級成 pane」：目前分頁變獨立 pane，rail 維持
 * 全真 pipeline：renderWithWorkspace；persist 斷言走 container LayoutStore。
 */
import {
  createFakeServer,
  createTestContainer,
  type LayoutStore,
  TYPES,
} from '@code-quest/server/test';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { setupMatchMedia } from '@/test/fake-match-media';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('drawer 單例（spec: 全域單例 drawer）', () => {
  it('rail ⤢ 開 drawer 顯示完整內容；esc 關閉；遮罩點擊關閉', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // rail 預設展開（files 分頁）→ ⤢ 開 drawer
    await user.click(screen.getByRole('button', { name: 'open in drawer' }));
    const drawer = await screen.findByTestId('workspace-drawer');
    expect(drawer).toBeInTheDocument();
    // drawer body 是 files 完整內容（與 rail 同 descriptor）
    expect(within(drawer).getByRole('region', { name: 'files-pane' })).toBeInTheDocument();

    // esc 關閉
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('workspace-drawer')).not.toBeInTheDocument();

    // 再開 → 遮罩點擊關閉；遮罩為 45% 輕遮罩（決策 8：bg-bg/45，非重 overlay token）
    await user.click(screen.getByRole('button', { name: 'open in drawer' }));
    await screen.findByTestId('workspace-drawer');
    expect(screen.getByTestId('drawer-overlay')).toHaveClass('bg-bg/45');
    await user.click(screen.getByTestId('drawer-overlay'));
    expect(screen.queryByTestId('workspace-drawer')).not.toBeInTheDocument();
  });

  it('⤢ 全螢幕 toggle；左緣把手存在（拖寬熱區）', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    await user.click(screen.getByRole('button', { name: 'open in drawer' }));
    const drawer = await screen.findByTestId('workspace-drawer');
    // jsdom 不解析 max(var(...)) —— 只斷言「非全螢幕」與把手存在
    expect(drawer.style.width).not.toBe('100%');
    expect(screen.getByTestId('drawer-grabber')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'toggle drawer fullscreen' }));
    expect(drawer.style.width).toBe('100%');
    await user.click(screen.getByRole('button', { name: 'toggle drawer fullscreen' }));
    expect(drawer.style.width).not.toBe('100%');
  });
});

describe('drawer 拖左緣調寬（handoff §5 grabber）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pointermove 即時寬度＝innerWidth−clientX；clamp 下限 480；pointerUp 後 move 不變', async () => {
    // jsdom 預設 innerWidth 1024：1024−600=424 會直接撞 clamp——拉大到 1600 先驗公式再驗 clamp
    vi.stubGlobal('innerWidth', 1600);
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    await user.click(screen.getByRole('button', { name: 'open in drawer' }));
    const drawer = await screen.findByTestId('workspace-drawer');

    // 往左拖 → 寬度＝innerWidth − clientX（pointermove 即時反映）
    fireEvent.pointerDown(screen.getByTestId('drawer-grabber'), { pointerId: 1, clientX: 800 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 600 });
    expect(drawer.style.width).toBe('1000px'); // 1600 − 600

    // 拖過頭往右 → clamp 下限 480（1600−1500=100 → 480）
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 1500 });
    expect(drawer.style.width).toBe('480px');

    // 放開後 move 不再生效（listener 已移除）
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 1500 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 700 });
    expect(drawer.style.width).toBe('480px');
  });
});

describe('釘選成 pane（spec: 釘選成 pane）', () => {
  it('⊞ 釘選：descriptor 轉新 leaf（右側 split）、drawer 關、layout 經 debounce 存檔', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);

    const { user, addProject } = await renderWithWorkspace({ summoner });
    const project = await addProject();
    await project.launchSession();
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);

    // rail 切到 git 分頁 → ⤢ 開 drawer → ⊞ 釘選
    await user.click(screen.getByRole('tab', { name: /Git/i }));
    await user.click(screen.getByRole('button', { name: 'open in drawer' }));
    await screen.findByTestId('workspace-drawer');
    await user.click(screen.getByRole('button', { name: /釘選成 pane/ }));

    // drawer 關、出現第二個 pane（git）
    expect(screen.queryByTestId('workspace-drawer')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);

    // layout 存檔含 git leaf（debounce 真管線）
    const summonerKey = container.get<{ provider: string }>(TYPES.ChannelManager).provider;
    await waitFor(
      async () => {
        const stored = await container.get<LayoutStore>(TYPES.LayoutStore).get(summonerKey);
        const root = stored?.layout.tabs[0]?.paneRoot;
        if (root?.type !== 'split') throw new Error('pending');
        expect(root.second).toMatchObject({ content: { type: 'git' } });
      },
      { timeout: 2000 },
    );
  });
});

describe('rail 升級成 pane（spec: 升級成 pane 與開 drawer）', () => {
  it('rail「⊞ 升級成 pane」：目前分頁變獨立 pane（同 cwd），rail 維持原狀', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    await user.click(screen.getByRole('tab', { name: /Git/i }));
    await user.click(screen.getByRole('button', { name: 'promote rail to pane' }));

    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    // rail 仍在（升級不收合）
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });
});

describe('mobile bottom sheet 三段 snap（6.5；spec: drawer 方向）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('拖 grabber 到頂 snap 100%、拖到底關閉', async () => {
    setupMatchMedia(375, (q, w) => {
      if (q === '(max-width: 767px)') return w <= 767;
      return false;
    });
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // mobile 下 rail 自動為 dock？rail 預設展開但 RO 不觸發——⤢ 仍可用
    await user.click(screen.getByRole('button', { name: 'open in drawer' }));
    const drawer = await screen.findByTestId('workspace-drawer');
    expect(drawer.style.height).toBe('66%');

    // 拖到頂（clientY 小 → ratio 高）→ snap 100%
    const grabber = screen.getByTestId('sheet-grabber');
    fireEvent.pointerDown(grabber, { pointerId: 1, clientY: 500 });
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 10 });
    expect(drawer.style.height).toBe('100%');

    // 拖到底（ratio < 0.33）→ 關閉
    fireEvent.pointerDown(screen.getByTestId('sheet-grabber'), { pointerId: 2, clientY: 100 });
    fireEvent.pointerUp(window, { pointerId: 2, clientY: window.innerHeight - 20 });
    expect(screen.queryByTestId('workspace-drawer')).not.toBeInTheDocument();
  });
});
