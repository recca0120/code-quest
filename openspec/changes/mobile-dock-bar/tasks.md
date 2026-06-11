# Mobile Dock Bar — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. MobileDockBar 元件

- [ ] 1.1 [test] renderWithWorkspace + mobile → MobileDockBar 渲染（data-testid="mobile-dock-bar"）；desktop → 不渲染
- [ ] 1.2 [impl] MobileDockBar 骨架（fixed bottom, h-(--hit-dock-chip), bg-surface, border-t, pb-(--safe-bottom)）
- [ ] 1.3 [test] MobileDockBar 顯示 PANE_TYPE_REGISTRY chips（排除 chat）：files/git/spec
- [ ] 1.4 [impl] chips 渲染（from registry, rounded-full, icon + label）

## 2. Chip 互動

- [ ] 2.1 [test] 點 chip → 在 focused pane 開對應 tool pane（onOpenToolPane 或 setContentInPane）
- [ ] 2.2 [impl] chip onClick → paneActions.setContentInPane(focusedPaneId, registry.makeContent(cwd))
- [ ] 2.3 [test] hint 文字「左右滑切 pane」顯示
- [ ] 2.4 [impl] hint span

## 3. 整合

- [ ] 3.1 [impl] TabContainer 在 mobile mode 渲染 MobileDockBar（PaneTree 下方）
- [ ] 3.2 [verify] tsc clean + 全套 vitest green
