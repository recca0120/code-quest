/**
 * P5 RWD（tmux-workspace-ui；spec: workspace-rwd）
 * - 斷點只改「同時渲染幾個 pane」：desktop 全樹／tablet 上限 2＋直立條／mobile 單 pane
 * - 收納不銷毀：condensed pane 的 session ChannelProvider 保活（hidden mount）
 * - 回桌面原樹還原
 * 全真 pipeline：renderWithWorkspace＋fake-match-media。
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupMatchMedia } from '@/test/fake-match-media';
import { renderWithWorkspace } from '@/test/render-with-workspace';

// useMobileMode 用 (max-width: 767px)；useTabletMode 用 768–1023 區間
function widthMatcher(query: string, width: number): boolean {
  if (query === '(max-width: 767px)') return width <= 767;
  if (query === '(min-width: 768px) and (max-width: 1023px)') return width >= 768 && width <= 1023;
  if (query === '(min-width: 1024px)') return width >= 1024;
  if (query === '(min-width: 768px)') return width >= 768;
  return false;
}

afterEach(() => {
  vi.restoreAllMocks();
});

async function fourPanes() {
  const mm = setupMatchMedia(1440, widthMatcher);
  const view = await renderWithWorkspace();
  const project = await view.addProject();
  await project.launchSession();
  // 標準工作組路徑外，手動 split 出 4 panes：split-h ×3（先序鏈）。
  // 分割自動開 picker（handoff：分割（開 picker 選內容））——esc 關閉留空 pane
  await view.user.click(screen.getAllByTestId('pane-split-h')[0]!);
  await view.user.keyboard('{Escape}');
  await view.user.click(screen.getAllByTestId('pane-split-h')[1]!);
  await view.user.keyboard('{Escape}');
  await view.user.click(screen.getAllByTestId('pane-split-h')[2]!);
  await view.user.keyboard('{Escape}');
  expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(4);
  return { mm, view };
}

describe('斷點只改渲染數，不銷毀 pane tree（spec 核心原則）', () => {
  it('tablet 上限 2＋直立條；點直立條項切入視野；回桌面原樹還原且 session 保活', async () => {
    const { mm, view } = await fourPanes();
    const chatCountBefore = screen.getAllByPlaceholderText(/Esc to focus/i).length;

    // → tablet（800px）：只渲染 2 leaf＋直立條收納其餘
    await act(async () => {
      mm.triggerChange(800);
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    const strip = screen.getByTestId('condensed-pane-strip');
    expect(within(strip).getAllByTestId(/^condensed-pane-/)).toHaveLength(2);

    // 收納不銷毀：chat session 的 composer 仍 mounted（hidden 保活區）
    expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(chatCountBefore);

    // 點直立條第一個 → 該 pane 進視野（focused 衍生 visible）
    const condensedId = within(strip).getAllByTestId(/^condensed-pane-/)[0]!.dataset.paneId!;
    await view.user.click(within(strip).getAllByTestId(/^condensed-pane-/)[0]!);
    await waitFor(() => {
      const visibleIds = screen.getAllByTestId('split-pane-leaf').map((l) => l.dataset.paneId);
      expect(visibleIds).toContain(condensedId);
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);

    // → 回桌面：原樹 4 panes 還原、直立條消失
    await act(async () => {
      mm.triggerChange(1440);
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(4);
    expect(screen.queryByTestId('condensed-pane-strip')).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(chatCountBefore);
  });

  it('tablet 直立條輪轉：點 condensed 後原 visible 之一回條上、徽章仍照全樹先序', async () => {
    const { mm, view } = await fourPanes();
    // 全樹先序（桌面 DOM 順序＝先序）——徽章編號的基準
    const order = screen.getAllByTestId('split-pane-leaf').map((l) => l.dataset.paneId!);
    await act(async () => {
      mm.triggerChange(800);
    });

    const visibleBefore = screen.getAllByTestId('split-pane-leaf').map((l) => l.dataset.paneId!);
    const strip = screen.getByTestId('condensed-pane-strip');
    const chipsBefore = within(strip).getAllByTestId(/^condensed-pane-/);
    const clickedId = chipsBefore[0]!.dataset.paneId!;

    await view.user.click(chipsBefore[0]!);
    await waitFor(() =>
      expect(screen.getAllByTestId('split-pane-leaf').map((l) => l.dataset.paneId)).toContain(
        clickedId,
      ),
    );

    // 輪轉：可見上限仍 2 → 原 visible 至少一個被擠回條上、條上仍 2 chip
    const chipsAfter = within(screen.getByTestId('condensed-pane-strip')).getAllByTestId(
      /^condensed-pane-/,
    );
    const condensedAfter = chipsAfter.map((c) => c.dataset.paneId!);
    expect(condensedAfter).toHaveLength(2);
    expect(condensedAfter.some((id) => visibleBefore.includes(id))).toBe(true);
    expect(condensedAfter).not.toContain(clickedId);

    // 徽章＝該 pane 在「全樹先序」的固定編號（①②③④），不隨條上位置重排
    const CIRCLED = '①②③④⑤⑥⑦⑧⑨';
    for (const chip of chipsAfter) {
      expect(chip.textContent).toContain(CIRCLED[order.indexOf(chip.dataset.paneId!)]);
    }
  });

  it('mobile 卡片牆：⊞ 開 2 欄卡片、點卡切 pane；左右滑切換 focus', async () => {
    const { mm, view } = await fourPanes();
    await act(async () => {
      mm.triggerChange(375);
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);

    // ⊞ 開卡片牆 → 每個 leaf 一張卡（卡序＝leaf 先序）
    await view.user.click(screen.getByTestId('mobile-pane-wall-toggle'));
    const wall = await screen.findByTestId('mobile-pane-wall');
    const cards = within(wall).getAllByTestId(/^pane-wall-card-/);
    expect(cards).toHaveLength(4);
    const order = cards.map((c) => c.dataset.paneId!);

    // 點第三張卡 → 該 pane 成為 solo、牆關閉
    await view.user.click(cards[2]!);
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-pane-wall')).not.toBeInTheDocument();
      expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[2]);
    });

    // 左滑＝先序「下一個」（order[3]），不是隨便換一個
    const root = screen.getByTestId('split-pane-root');
    fireEvent.touchStart(root, { changedTouches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 100, clientY: 200 }] });
    await waitFor(() =>
      expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[3]),
    );

    // 右滑＝反向回「上一個」（order[2]）
    fireEvent.touchStart(root, { changedTouches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 300, clientY: 200 }] });
    await waitFor(() =>
      expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[2]),
    );
  });

  it('swipe 邊界：首 pane 右滑不動、尾 pane 左滑不動、|dx|<50 不動', async () => {
    const { mm, view } = await fourPanes();
    // 全樹先序（桌面 DOM 順序＝先序）——mobile 收起前先記下
    const order = screen.getAllByTestId('split-pane-leaf').map((l) => l.dataset.paneId!);
    await act(async () => {
      mm.triggerChange(375);
    });

    const swipe = (fromX: number, toX: number) => {
      const root = screen.getByTestId('split-pane-root');
      fireEvent.touchStart(root, { changedTouches: [{ clientX: fromX, clientY: 200 }] });
      fireEvent.touchEnd(root, { changedTouches: [{ clientX: toX, clientY: 200 }] });
    };

    // 卡片牆切到首 pane
    await view.user.click(screen.getByTestId('mobile-pane-wall-toggle'));
    await view.user.click(await screen.findByTestId(`pane-wall-card-${order[0]}`));
    await waitFor(() =>
      expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[0]),
    );

    // 首 pane 右滑（沒有上一個）→ 不動（也不准 wrap 到尾）
    swipe(100, 300);
    expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[0]);

    // |dx| < 50（左滑 40px）→ 視為誤觸，不動
    swipe(200, 160);
    expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[0]);

    // 對照組：足量左滑會動到先序下一個——證明前兩個「不動」不是 touch 模擬失效的假綠
    swipe(300, 100);
    await waitFor(() =>
      expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[1]),
    );

    // 卡片牆切到尾 pane → 左滑（沒有下一個）→ 不動
    await view.user.click(screen.getByTestId('mobile-pane-wall-toggle'));
    await view.user.click(await screen.findByTestId(`pane-wall-card-${order[3]}`));
    await waitFor(() =>
      expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[3]),
    );
    swipe(300, 100);
    expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(order[3]);
  });

  it('遮罩鈕 close pane switcher：牆關閉、solo pane 不變', async () => {
    const { mm, view } = await fourPanes();
    await act(async () => {
      mm.triggerChange(375);
    });
    const soloBefore = screen.getByTestId('split-pane-leaf').dataset.paneId;

    await view.user.click(screen.getByTestId('mobile-pane-wall-toggle'));
    await screen.findByTestId('mobile-pane-wall');

    await view.user.click(screen.getByRole('button', { name: 'close pane switcher' }));
    await waitFor(() => expect(screen.queryByTestId('mobile-pane-wall')).not.toBeInTheDocument());
    // 沒點卡 → focus 沒換，solo 維持原 pane
    expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(soloBefore);
  });

  it('mobile 單 pane：condensed sessions 一樣保活', async () => {
    const { mm } = await fourPanes();
    const chatCountBefore = screen.getAllByPlaceholderText(/Esc to focus/i).length;

    await act(async () => {
      mm.triggerChange(375);
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    // 保活：composer 數不變（其餘在 hidden 保活區）
    expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(chatCountBefore);
  });
});

describe('MobileDockBar（mobile-dock-bar）', () => {
  it('mobile mode → MobileDockBar 渲染；desktop → 不渲染', async () => {
    const mm = setupMatchMedia(1440, widthMatcher);
    const view = await renderWithWorkspace();
    const project = await view.addProject();
    await project.launchSession();

    expect(screen.queryByTestId('mobile-dock-bar')).not.toBeInTheDocument();

    await act(async () => mm.triggerChange(375));
    expect(screen.getByTestId('mobile-dock-bar')).toBeInTheDocument();

    await act(async () => mm.triggerChange(1440));
    expect(screen.queryByTestId('mobile-dock-bar')).not.toBeInTheDocument();
  });

  it('顯示 pane type chips（files/git/spec，不含 chat）+ hint 文字', async () => {
    setupMatchMedia(375, widthMatcher);
    const view = await renderWithWorkspace();
    const project = await view.addProject();
    await project.launchSession();

    const bar = screen.getByTestId('mobile-dock-bar');
    expect(within(bar).getByText('files')).toBeInTheDocument();
    expect(within(bar).getByText('git')).toBeInTheDocument();
    expect(within(bar).getByText('spec')).toBeInTheDocument();
    expect(within(bar).queryByText('chat')).not.toBeInTheDocument();
    expect(within(bar).getByText(/左右滑切 pane/)).toBeInTheDocument();
  });
});

describe('MobileTopBar（mobile-rwd-polish B2）', () => {
  it('mobile mode → MobileTopBar 渲染；desktop → 不渲染', async () => {
    const mm = setupMatchMedia(1440, widthMatcher);
    const view = await renderWithWorkspace();
    const project = await view.addProject();
    await project.launchSession();

    // desktop: no topbar
    expect(screen.queryByTestId('mobile-topbar')).not.toBeInTheDocument();

    // → mobile
    await act(async () => mm.triggerChange(375));
    expect(screen.getByTestId('mobile-topbar')).toBeInTheDocument();

    // → back to desktop
    await act(async () => mm.triggerChange(1440));
    expect(screen.queryByTestId('mobile-topbar')).not.toBeInTheDocument();
  });

  it('pane dots 顯示 leaf 數量；focused 有 accent；點擊切換 pane', async () => {
    const { mm, view } = await fourPanes();
    await act(async () => mm.triggerChange(375));

    const topbar = screen.getByTestId('mobile-topbar');
    const dots = within(topbar).getAllByTestId(/^mobile-pane-dot-/);
    expect(dots).toHaveLength(4);

    // focused dot has accent marker
    const focusedDot = dots.find((d) => d.hasAttribute('data-active'));
    expect(focusedDot).toBeTruthy();

    // 點其他 dot 切 pane
    const otherDot = dots.find((d) => !d.hasAttribute('data-active'))!;
    const targetId = otherDot.dataset.paneId!;
    await view.user.click(otherDot);
    await waitFor(() =>
      expect(screen.getByTestId('split-pane-leaf').dataset.paneId).toBe(targetId),
    );
  });

  it('⊞ 按鈕開啟 MobilePaneWall', async () => {
    const mm = setupMatchMedia(1440, widthMatcher);
    const view = await renderWithWorkspace();
    const project = await view.addProject();
    await project.launchSession();
    await view.user.click(screen.getAllByTestId('pane-split-h')[0]!);
    await view.user.keyboard('{Escape}');

    await act(async () => mm.triggerChange(375));

    const topbar = screen.getByTestId('mobile-topbar');
    await view.user.click(within(topbar).getByTestId('mobile-topbar-wall-toggle'));
    expect(await screen.findByTestId('mobile-pane-wall')).toBeInTheDocument();
  });
});

describe('卡片牆 Preview 縮影（mobile-rwd-polish B3）', () => {
  it('chat pane 卡片顯示 title preview；tool pane 卡片顯示 registry icon + basename；＋ 新增卡', async () => {
    const mm = setupMatchMedia(1440, widthMatcher);
    const view = await renderWithWorkspace();
    const project = await view.addProject();
    await project.launchSession();

    // split 開 git pane
    const leaf = screen.getByTestId('split-pane-leaf');
    vi.spyOn(leaf, 'getBoundingClientRect').mockReturnValue({
      width: 1200,
      height: 800,
    } as DOMRect);
    await view.user.click(screen.getAllByTestId('pane-split-h')[0]!);
    // picker 裡選 git
    await view.user.click(await screen.findByTestId('picker-type-git'));

    await act(async () => mm.triggerChange(375));

    // 開卡片牆
    const topbar = screen.getByTestId('mobile-topbar');
    await view.user.click(within(topbar).getByTestId('mobile-topbar-wall-toggle'));
    const wall = await screen.findByTestId('mobile-pane-wall');
    const cards = within(wall).getAllByTestId(/^pane-wall-card-/);
    expect(cards).toHaveLength(2);

    // chat card 有 preview（✦ icon）
    const chatPreview = within(wall).getAllByTestId(/^pane-wall-preview-/);
    expect(chatPreview.length).toBeGreaterThanOrEqual(1);

    // ＋ 新增卡存在
    expect(within(wall).getByTestId('pane-wall-add-card')).toBeInTheDocument();
  });
});

describe('tablet portrait slide-over（handoff §8 直向）', () => {
  function portraitMatcher(query: string, width: number): boolean {
    if (query === '(max-width: 767px)') return width <= 767;
    if (query === '(min-width: 768px) and (max-width: 1023px)')
      return width >= 768 && width <= 1023;
    if (query === '(orientation: portrait)') return width >= 768 && width <= 1023;
    return false;
  }

  async function twoPanesPortrait() {
    const mm = setupMatchMedia(800, portraitMatcher);
    const view = await renderWithWorkspace();
    const project = await view.addProject();
    await project.launchSession();

    // split 時需 desktop 寬度讓 split 成功（min-size 護欄）
    const leaf = screen.getByTestId('split-pane-leaf');
    const spy = vi
      .spyOn(leaf, 'getBoundingClientRect')
      .mockReturnValue({ width: 1200, height: 800 } as DOMRect);
    await view.user.click(screen.getAllByTestId('pane-split-h')[0]!);
    await view.user.keyboard('{Escape}');
    spy.mockRestore();
    // portrait mode → PaneTree 應渲染 slide-over 而非正常 split
    return { mm, view };
  }

  it('tablet portrait + 2 leaf → 主 pane + focused secondary 以 slide-over overlay', async () => {
    await twoPanesPortrait();

    // 分割後 focus 在新 pane（第二個）→ slide-over 應出現
    await waitFor(() => expect(screen.getByTestId('slide-over-pane')).toBeInTheDocument());
    expect(screen.getAllByTestId('split-pane-leaf').length).toBeGreaterThanOrEqual(1);
  });

  it('focus 切回第一個 pane → slide-over 收回', async () => {
    const { view } = await twoPanesPortrait();
    await waitFor(() => expect(screen.getByTestId('slide-over-pane')).toBeInTheDocument());

    // 點主 pane（第一個 leaf）→ slide-over 應消失
    const leaves = screen.getAllByTestId('split-pane-leaf');
    await view.user.click(leaves[0]!);
    await waitFor(() => expect(screen.queryByTestId('slide-over-pane')).not.toBeInTheDocument());
  });
});

describe('min-size 護欄（spec: 最小尺寸護欄；6.0）', () => {
  it('pane 實寬 < 640（2×320）時拒絕水平分割並 toast；夠寬則放行', async () => {
    setupMatchMedia(1440, widthMatcher);
    const view = await renderWithWorkspace();
    const project = await view.addProject();
    await project.launchSession();

    const leaf = screen.getByTestId('split-pane-leaf');
    const spy = vi
      .spyOn(leaf, 'getBoundingClientRect')
      .mockReturnValue({ width: 500, height: 800 } as DOMRect);

    await view.user.click(screen.getByTestId('pane-split-h'));
    // 分割被拒：仍 1 leaf＋toast 提示；min-size guard 拒絕時不自動開 picker
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    expect(await screen.findByText(/太小無法分割/)).toBeInTheDocument();
    expect(screen.queryByTestId('pane-picker-miller')).not.toBeInTheDocument();

    // 夠寬放行（分割成功 → picker 自動開啟）
    spy.mockReturnValue({ width: 1200, height: 800 } as DOMRect);
    await view.user.click(screen.getByTestId('pane-split-h'));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
    expect(screen.getByTestId('pane-picker-miller')).toBeInTheDocument();
  });
});
