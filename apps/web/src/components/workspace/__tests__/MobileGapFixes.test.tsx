/**
 * Gap-M: Mobile 強制單 pane — focused leaf solo rendering。
 * （Gap-C SessionBar overflow 在 SessionBarOverflow.test.tsx。）
 *
 * 全真寫法（fake-summoner-client skill）：最小真 provider stack（Socket→AppConfig→
 * Project→Git→Tab→KeyboardShortcuts）＋真 PaneLeafBody（空 session leaf 渲染輕量
 * EmptyPane）。驅動走真 UI：toolbar 的 pane-split-h、click-to-focus、⌘⌥←/→ 切 focus。
 * mobile 切換用 setupMatchMedia 的視窗寬度——split 按鈕在 mobile 隱藏，
 * 所以真實流程是「桌面分割 → 縮到手機寬」。
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardShortcutsProvider } from '@/components/workspace/KeyboardShortcutsProvider';
import { PaneTree } from '@/components/workspace/PaneTree';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import { GitProvider } from '@/contexts/GitContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { setupMatchMedia } from '@/test/fake-match-media';
import { createFakeSummoner } from '@/test/fake-summoner';

/** useMobileMode 用 (max-width: 767px)；default matcher 只認 min-width → 自帶雙向 matcher */
function widthMatcher(query: string, width: number): boolean {
  const min = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (min) return width >= Number(min[1]);
  const max = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (max) return width <= Number(max[1]);
  return false;
}

afterEach(() => vi.restoreAllMocks());

function renderPaneTree() {
  const summoner = createFakeSummoner(); // 內建真 createFakeServer
  return render(
    <SocketProvider socket={summoner.socket}>
      <AppConfigProvider>
        <ProjectProvider>
          <GitProvider>
            <TabProvider>
              <KeyboardShortcutsProvider>
                <PaneTree />
              </KeyboardShortcutsProvider>
            </TabProvider>
          </GitProvider>
        </ProjectProvider>
      </AppConfigProvider>
    </SocketProvider>,
  );
}

const leaves = () => screen.getAllByTestId('split-pane-leaf');
const paneIds = () => leaves().map((el) => el.dataset.paneId);

describe('Gap-M: Mobile forces single pane display', () => {
  it('縮到 mobile 後只渲染 focused leaf — split wrapper、divider、另一 leaf 都不在 DOM', async () => {
    const user = userEvent.setup();
    const mm = setupMatchMedia(1280, widthMatcher);
    renderPaneTree();

    // 桌面先 split（split 按鈕在 mobile 隱藏）；splitNode 把原 leaf 放 first
    await user.click(screen.getByTestId('pane-split-h'));
    expect(leaves()).toHaveLength(2);
    const [firstId] = paneIds();

    // click-to-focus 第一個 pane，再縮到手機寬
    await user.click(leaves()[0]!);
    act(() => mm.triggerChange(375));

    // Solo rendering: only the focused leaf is in the DOM — the split wrapper,
    // divider and the other leaf are not rendered at all (it fills the area)
    expect(leaves()).toHaveLength(1);
    expect(leaves()[0]!.dataset.paneId).toBe(firstId);
    expect(screen.queryByTestId('pane-divider')).toBeNull();
    expect(screen.queryByTestId('split-pane-split')).toBeNull();
  });

  it('desktop split 後兩個 leaf 都渲染、無 hidden、divider 存在', async () => {
    const user = userEvent.setup();
    setupMatchMedia(1280, widthMatcher);
    renderPaneTree();

    await user.click(screen.getByTestId('pane-split-h'));

    expect(leaves()).toHaveLength(2);
    expect(leaves().filter((el) => el.hasAttribute('hidden'))).toHaveLength(0);
    expect(screen.getByTestId('pane-divider')).toBeInTheDocument();
  });

  it('mobile 切換 focus（⌘⌥←/→）→ solo pane 跟著換', async () => {
    const user = userEvent.setup();
    const mm = setupMatchMedia(1280, widthMatcher);
    renderPaneTree();

    await user.click(screen.getByTestId('pane-split-h'));
    const [firstId, secondId] = paneIds();

    // split 後 focus 落在新 leaf（second）→ 縮到手機只剩 second
    act(() => mm.triggerChange(375));
    expect(leaves()).toHaveLength(1);
    expect(leaves()[0]!.dataset.paneId).toBe(secondId);

    // ⌘⌥← 把 focus 移到 first → solo 換成 first
    await user.keyboard('{Meta>}{Alt>}{ArrowLeft}{/Alt}{/Meta}');
    expect(leaves()).toHaveLength(1);
    expect(leaves()[0]!.dataset.paneId).toBe(firstId);

    // ⌘⌥→ 回到 second
    await user.keyboard('{Meta>}{Alt>}{ArrowRight}{/Alt}{/Meta}');
    expect(leaves()).toHaveLength(1);
    expect(leaves()[0]!.dataset.paneId).toBe(secondId);
  });
});
