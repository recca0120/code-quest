/**
 * P5 RWD（tmux-workspace-ui；spec: workspace-rwd）
 * - 斷點只改「同時渲染幾個 pane」：desktop 全樹／tablet 上限 2＋直立條／mobile 單 pane
 * - 收納不銷毀：condensed pane 的 session ChannelProvider 保活（hidden mount）
 * - 回桌面原樹還原
 * 全真 pipeline：renderWithWorkspace＋fake-match-media。
 */
import { act, screen, waitFor, within } from '@testing-library/react';
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
  // 標準工作組路徑外，手動 split 出 4 panes：split-h ×3（先序鏈）
  await view.user.click(screen.getAllByTestId('pane-split-h')[0]!);
  await view.user.click(screen.getAllByTestId('pane-split-h')[1]!);
  await view.user.click(screen.getAllByTestId('pane-split-h')[2]!);
  expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(4);
  return { mm, view };
}

describe('斷點只改渲染數，不銷毀 pane tree（spec 核心原則）', () => {
  it('tablet 上限 2＋直立條；點直立條項切入視野；回桌面原樹還原且 session 保活', async () => {
    const { mm } = await fourPanes();
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
    await within(strip)
      .getAllByTestId(/^condensed-pane-/)[0]!
      .click();
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
    // 分割被拒：仍 1 leaf＋toast 提示
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
    expect(await screen.findByText(/太小無法分割/)).toBeInTheDocument();

    // 夠寬放行
    spy.mockReturnValue({ width: 1200, height: 800 } as DOMRect);
    await view.user.click(screen.getByTestId('pane-split-h'));
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(2);
  });
});
