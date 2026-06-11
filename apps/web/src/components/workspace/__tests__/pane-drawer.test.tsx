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
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';
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

    // 再開 → 遮罩點擊關閉
    await user.click(screen.getByRole('button', { name: 'open in drawer' }));
    await screen.findByTestId('workspace-drawer');
    await user.click(screen.getByTestId('drawer-overlay'));
    expect(screen.queryByTestId('workspace-drawer')).not.toBeInTheDocument();
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
      () => {
        const stored = container.get<LayoutStore>(TYPES.LayoutStore).get(summonerKey);
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
