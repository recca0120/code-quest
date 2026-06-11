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

interface FakeRO {
  cb: (entries: { contentRect: { width: number } }[]) => void;
  targets: Element[];
  disconnected: boolean;
}

/** instance-tracking RO fake：記每個 instance 的 observe target 與 disconnected flag，
 *  cb 由測試手動觸發（jsdom 無 layout）。記得 afterEach `vi.unstubAllGlobals()`。 */
function installFakeResizeObserver(): FakeRO[] {
  const instances: FakeRO[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly entry: FakeRO;
      constructor(cb: FakeRO['cb']) {
        this.entry = { cb, targets: [], disconnected: false };
        instances.push(this.entry);
      }
      observe(target: Element): void {
        this.entry.targets.push(target);
      }
      unobserve(target: Element): void {
        this.entry.targets = this.entry.targets.filter((t) => t !== target);
      }
      disconnect(): void {
        this.entry.disconnected = true;
      }
    },
  );
  return instances;
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
      async () => {
        const stored = await container
          .get<LayoutStore>(TYPES.LayoutStore)
          .get(summonerKeyOf(container));
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
    const instances = installFakeResizeObserver();

    const { addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();

    // pane 變窄 → 自動收合
    await act(async () => {
      for (const inst of instances) inst.cb([{ contentRect: { width: 600 } }]);
    });
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
    expect(screen.getByTestId('pane-dock')).toBeInTheDocument();

    // 恢復寬度 → 維持 dock（尊重上次狀態，不自動展開）
    await act(async () => {
      for (const inst of instances) inst.cb([{ contentRect: { width: 1000 } }]);
    });
    expect(screen.queryByRole('region', { name: 'right-pane-body' })).not.toBeInTheDocument();
  });

  it('close pane 後 SessionPane 的 RO instance disconnect；stale callback 觸發不 throw', async () => {
    const instances = installFakeResizeObserver();

    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // SessionPane 的 RO instance＝observe target 是 rail body 祖先（pane body div）的那個
    const railBody = screen.getByRole('region', { name: 'right-pane-body' });
    const sessionRO = instances.find((inst) => inst.targets.some((t) => t.contains(railBody)));
    if (!sessionRO) throw new Error('SessionPane 的 ResizeObserver instance 不存在');
    expect(sessionRO.disconnected).toBe(false);

    // 升級出第二個 pane（files，rail 預設分頁）→ 關閉 session pane（剩 files pane）
    await user.click(screen.getByRole('button', { name: 'promote rail to pane' }));
    const leaves = screen.getAllByTestId('split-pane-leaf');
    expect(leaves).toHaveLength(2);
    await user.click(within(leaves[0]!).getByTestId('pane-close'));
    const remaining = screen.getAllByTestId('split-pane-leaf');
    expect(remaining).toHaveLength(1);
    expect(within(remaining[0]!).getByRole('region', { name: 'files-pane' })).toBeInTheDocument();

    // unmount cleanup 跑過 → disconnect；stale callback 再觸發為 no-op（不 throw）
    expect(sessionRO.disconnected).toBe(true);
    await act(async () => {
      sessionRO.cb([{ contentRect: { width: 600 } }]);
    });
    expect(screen.getAllByTestId('split-pane-leaf')).toHaveLength(1);
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
      async () => {
        const stored = await container
          .get<LayoutStore>(TYPES.LayoutStore)
          .get(summonerKeyOf(container));
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

  it('clamp [180, 560]：拖過頭取邊界值；放開後邊界值 persist、move 不再生效', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);

    const { addProject } = await renderWithWorkspace({ summoner });
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

    // 放開的邊界值走 debounce persist 進 server LayoutStore
    await waitFor(
      async () => {
        const stored = await container
          .get<LayoutStore>(TYPES.LayoutStore)
          .get(summonerKeyOf(container));
        const root = stored?.layout.tabs[0]?.paneRoot;
        if (root?.type !== 'leaf' || root.content.type !== 'session') throw new Error('pending');
        expect(root.content.rail).toMatchObject({ width: 180 });
      },
      { timeout: 2000 },
    );

    // pointerUp 後 move 不再生效（listener 已移除）
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 1000 });
    expect(screen.getByTestId('chat-rail-wrapper').style.width).toBe('180px');
  });
});

describe('dock chips count 徽章（6.5）', () => {
  it('git 有變更時 files/git chips 顯示 changedFilesCount', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    summoner.git()!.setChangedFiles([
      { status: 'M', file: 'a.ts' },
      { status: 'A', file: 'b.ts' },
    ]);

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

describe('spec count（openspec list → rail 分頁徽章／dock chip）', () => {
  it('點 Spec 分頁：真 openspec list 載入 primed changes，分頁徽章顯示 ·2', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    summoner.openspec()!.setChanges([
      { name: 'add-foo', tasks: { done: 1, total: 3 }, status: 'in-progress' },
      { name: 'fix-bar', tasks: null, status: 'no-tasks' },
    ]);

    const { user, addProject } = await renderWithWorkspace({ summoner });
    const project = await addProject();
    await project.launchSession();

    // 真 pipeline：SpecView 經 openspec:list RPC 列出 primed changes
    await user.click(screen.getByRole('tab', { name: /Spec/i }));
    expect(await screen.findByText('add-foo')).toBeInTheDocument();
    expect(screen.getByText('fix-bar')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('rail-tab-count-spec')).toHaveTextContent('·2'));
  });

  it('空 changes：Spec 分頁載入完成後 count 0 不顯示徽章', async () => {
    const { user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    // 等 SpecView 真載入完（空清單 placeholder）再驗徽章缺席——避免 pending fetch 的 vacuous pass
    await user.click(screen.getByRole('tab', { name: /Spec/i }));
    expect(await screen.findByText('No active changes')).toBeInTheDocument();
    expect(screen.queryByTestId('rail-tab-count-spec')).not.toBeInTheDocument();
  });

  it('不開 spec 收合：list error → spec count null，dock chip 無徽章（git 徽章照常）', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    onTestFinished(() => server.destroy());
    const summoner = createFakeSummoner(server);
    summoner.git()!.setChangedFiles([{ status: 'M', file: 'a.ts' }]);
    summoner.openspec()!.setListError('openspec-cli-not-found');

    const { user, addProject } = await renderWithWorkspace({ summoner });
    const project = await addProject();
    await project.launchSession();

    await user.click(screen.getByRole('button', { name: 'collapse rail' }));
    const dock = screen.getByTestId('pane-dock');
    // git count 已到（counts 管線活著）→ spec 徽章缺席非 vacuous
    await waitFor(() =>
      expect(within(dock).getByTestId('pane-dock-count-git')).toHaveTextContent('1'),
    );
    expect(within(dock).queryByTestId('pane-dock-count-spec')).not.toBeInTheDocument();
  });
});
