/**
 * P3 chat rail/dock（tmux-workspace-ui；spec: chat-tool-rail）
 * - rail 預設展開（handoff 定案：新 chat 預設展開側欄）
 * - ⇥ 收合 ↔ dock chips（同一資料源、兩種展開態）
 * - { railOpen, railTab } 進 leaf content params → layout persistence roundtrip
 * 全真 pipeline：renderWithWorkspace；persist 斷言走 container LayoutStore。
 */
import {
  createFakeServer,
  createTestContainer,
  type LayoutStore,
  TYPES,
} from '@code-quest/server/test';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

function summonerKeyOf(container: ReturnType<typeof createTestContainer>): string {
  return container.get<{ provider: string }>(TYPES.ChannelManager).provider;
}

describe('rail 預設展開＋⇥ 收合 ↔ dock（spec: 同一資料源的兩種展開態）', () => {
  it('新 chat 預設展開 rail；⇥ 收合變 dock chips；點 chip 展開回該分頁', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // 預設展開（handoff: 新 chat 預設展開側欄）
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();

    // ⇥ 收合 → rail 消失、dock chips 出現（files/git/spec 三顆）
    await user.click(screen.getByRole('button', { name: 'collapse rail' }));
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
    const dock = screen.getByTestId('pane-dock');
    expect(within(dock).getByTestId('pane-dock-chip-files')).toBeInTheDocument();
    expect(within(dock).getByTestId('pane-dock-chip-git')).toBeInTheDocument();
    expect(within(dock).getByTestId('pane-dock-chip-spec')).toBeInTheDocument();

    // 點 git chip → rail 展開且停在 git 分頁
    await user.click(within(dock).getByTestId('pane-dock-chip-git'));
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
    expect(screen.queryByTestId('pane-dock')).not.toBeInTheDocument();
  });
});

describe('rail 狀態 persist roundtrip（spec: per-pane persist）', () => {
  it('收合＋切分頁寫進 layout（server store），reload 後還原 dock 態與分頁', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());

    const s1 = createFakeSummoner(server);
    const view1 = await renderWithWorkspace({ summoner: s1 });
    const project = await view1.addProject();
    await project.launchSession();

    // 收合 rail → debounce save 後 server store 的 session leaf 帶 rail
    await view1.user.click(screen.getByRole('button', { name: 'collapse rail' }));
    await waitFor(
      () => {
        const stored = container.get<LayoutStore>(TYPES.LayoutStore).get(summonerKeyOf(container));
        const root = stored?.layout.tabs[0]?.paneRoot;
        if (root?.type !== 'leaf' || root.content.type !== 'session') throw new Error('pending');
        expect(root.content.rail).toMatchObject({ open: false });
      },
      { timeout: 2000 },
    );
    view1.unmount();

    // 「reload」：新 client 同 server → dock 態還原（rail 不展開）
    const s2 = createFakeSummoner(server);
    await renderWithWorkspace({ summoner: s2 });
    await waitFor(() => expect(screen.getByTestId('pane-dock')).toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
  });
});

describe('窄 pane 自動收合（spec: <720px 自動收合）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pane 寬 <720 時 rail 自動收合成 dock；恢復寬度不自動展開', async () => {
    // fake ResizeObserver：記住 callback，測試手動觸發寬度變化
    const callbacks: Array<(entries: { contentRect: { width: number } }[]) => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        cb: (entries: { contentRect: { width: number } }[]) => void;
        constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
          this.cb = cb;
          callbacks.push(cb);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );

    const { addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();

    // pane 變窄 → 自動收合
    await act(async () => {
      for (const cb of callbacks) cb([{ contentRect: { width: 600 } }]);
    });
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
    expect(screen.getByTestId('pane-dock')).toBeInTheDocument();

    // 恢復寬度 → 維持 dock（尊重上次狀態，不自動展開）
    await act(async () => {
      for (const cb of callbacks) cb([{ contentRect: { width: 1000 } }]);
    });
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
  });
});

describe('⌘⏎ 升級成 pane（spec: rail/dock 鍵盤升級 SHALL）', () => {
  it('焦點在 rail 區內按 ⌘⏎ → 目前分頁升級成獨立 pane（同 cwd）', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);

    // 焦點移進 rail（點 Git 分頁 → trigger 取得焦點、分頁切到 git）
    await user.click(screen.getByRole('tab', { name: /Git/i }));
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(2);
    expect(within(leaves[1]!).getByRole('region', { name: 'git-pane' })).toBeInTheDocument();
  });

  it('焦點在 dock 區按 ⌘⏎ → activeTab 升級成獨立 pane', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // 收合成 dock（activeTab 停留在 files）
    await user.click(screen.getByRole('button', { name: 'collapse rail' }));
    const dock = screen.getByTestId('pane-dock');

    // 焦點落在 dock 區內（chip 按鈕），⌘⏎ 升級 activeTab
    act(() => within(dock).getByTestId('pane-dock-chip-files').focus());
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(2);
    expect(within(leaves[1]!).getByRole('region', { name: 'files-pane' })).toBeInTheDocument();
  });
});

describe('rail 拖寬把手（rail resize；persist width）', () => {
  it('拖左緣把手即時改寬（local），放開才寫 persist；reload 還原寬度', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());

    const s1 = createFakeSummoner(server);
    const view1 = await renderWithWorkspace({ summoner: s1 });
    const project = await view1.addProject();
    await project.launchSession();

    // 預設寬度走 token（無 inline width 覆寫）
    const wrapper = screen.getByTestId('chat-rail-wrapper');
    expect(wrapper.style.width).toBe('');

    // 往左拖 100px → 寬度 = 預設 218 + 100 = 318（pointermove 即時反映）
    const grabber = screen.getByTestId('rail-grabber');
    fireEvent.pointerDown(grabber, { pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 400 });
    expect(screen.getByTestId('chat-rail-wrapper').style.width).toBe('318px');

    // 放開 → 寫進 rail persist state（debounce save 後 server store 帶 width）
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 400 });
    expect(screen.getByTestId('chat-rail-wrapper').style.width).toBe('318px');
    await waitFor(
      () => {
        const stored = container.get<LayoutStore>(TYPES.LayoutStore).get(summonerKeyOf(container));
        const root = stored?.layout.tabs[0]?.paneRoot;
        if (root?.type !== 'leaf' || root.content.type !== 'session') throw new Error('pending');
        expect(root.content.rail).toMatchObject({ width: 318 });
      },
      { timeout: 2000 },
    );
    view1.unmount();

    // 「reload」：新 client 同 server → rail 寬度還原
    const s2 = createFakeSummoner(server);
    await renderWithWorkspace({ summoner: s2 });
    await waitFor(() => expect(screen.getByTestId('chat-rail-wrapper').style.width).toBe('318px'), {
      timeout: 2000,
    });
  });

  it('clamp [180, 560]：拖過頭取邊界值', async () => {
    const { addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // 往左拖 1000px → clamp 上限 560
    fireEvent.pointerDown(screen.getByTestId('rail-grabber'), { pointerId: 1, clientX: 1200 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 200 });
    expect(screen.getByTestId('chat-rail-wrapper').style.width).toBe('560px');

    // 反向拖回過頭 → clamp 下限 180
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 2400 });
    expect(screen.getByTestId('chat-rail-wrapper').style.width).toBe('180px');
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 2400 });
  });
});

describe('dock chips count 徽章（6.5）', () => {
  it('git 有變更時 files/git chips 顯示 changedFilesCount', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    summoner.git()!.setChangedFiles([
      { path: 'a.ts', status: 'M' },
      { path: 'b.ts', status: 'A' },
    ] as never);

    const { user, addProject } = await renderWithWorkspace({ summoner });
    const project = await addProject();
    await project.launchSession();

    await user.click(screen.getByRole('button', { name: 'collapse rail' }));
    await waitFor(() => {
      expect(screen.getByTestId('pane-dock-count-git')).toHaveTextContent('2');
      expect(screen.getByTestId('pane-dock-count-files')).toHaveTextContent('2');
    });
  });
});
