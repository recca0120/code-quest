# Design Alignment Audit — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. CRITICAL — Token / 選擇器

- [x] 1.1 [test] App.css.test：data-theme="clay-dark" 選擇器存在且覆寫色彩 token
- [x] 1.2 [impl] App.css `[data-theme="dark"]` → `[data-theme="clay-dark"]`；更新 comment L129-131
- [x] 1.3 [test] App.css.test：`--radius-chip` 值為 5px
- [x] 1.4 [impl] App.css `--radius-chip: 4px` → `5px`
- [x] 1.5 [test] App.css.test：reduced-motion 區塊含 `--theme-transition: 0ms`
- [x] 1.6 [impl] App.css prefers-reduced-motion 區塊補 `--theme-transition: 0ms`

## 2. CRITICAL — 字級對齊

- [x] 2.1 [test] Pane header 標題 class 含 `--text-ui`（12px）
- [x] 2.2 [impl] Pane.tsx 標題 span 加 `text-[length:var(--text-ui)]`
- [x] 2.3 [test] Statusline class 含 `--text-statusline`（10.5px）
- [x] 2.4 [impl] WorkspaceStatusline.tsx `text-2xs` → `text-[length:var(--text-statusline)]`

## 3. CRITICAL — Mobile / SlideOver

- [x] 3.1 [test] renderWithWorkspace + mobile viewport：pane header 不可拖曳（draggable=false）
- [x] 3.2 [impl] Pane.tsx `draggable="true"` → `draggable={!isMobile}`；PaneTree drop handlers 加 mobile guard
- [x] 3.3 [test] renderWithWorkspace + tablet portrait：左拖 slide-over → pane tree 新增永久 split
- [x] 3.4 [impl] PaneTree PortraitSlideOver 補傳 onPinToSplit callback

## 4. WARNING — 元件樣式對齊

- [ ] 4.1 [test] Rail tab 字級為 11px（非 10px）
- [ ] 4.2 [impl] RightPane.tsx + PaneDock.tsx：tab/chip label 字級 → 11px token
- [ ] 4.3 [test] Rail hint 列含「⤢ 點項目開 drawer」＋「⌘⏎ 升級成 pane」
- [ ] 4.4 [impl] RightPane.tsx hint 文字補完；PaneDock.tsx hint 文字補完
- [ ] 4.5 [test] ZoomBar 背景用 `--color-accent-soft` token；DropZones 同
- [ ] 4.6 [impl] ZoomBar.tsx + PaneTree.tsx DropZones：`bg-accent/10` → `bg-(--color-accent-soft)`
- [ ] 4.7 [test] MobileTopBar pane dots 字號 22px
- [ ] 4.8 [impl] MobileTopBar.tsx pane dots `text-sm` → 22px
- [ ] 4.9 [test] PanePicker Miller 列 minHeight ≥ 28px（compact density 下）
- [ ] 4.10 [impl] PanePicker.tsx 欄1/欄2 列加 minHeight 保護

## 5. WARNING — Drawer 樣式

- [ ] 5.1 [test] Drawer ⊞ 釘選按鈕為 primary 樣式（bg-accent text-on-accent）
- [ ] 5.2 [impl] DrawerHost.tsx ⊞ 按鈕改 primary 樣式
- [ ] 5.3 [impl] DrawerHost.tsx 移除 diffstat TODO 註解（功能 out of scope，不留空 TODO）

## 6. Dead Code 清理

- [ ] 6.1 [impl] App.tsx 移除 `ds.font = fontSize`；App.css 移除 `[data-font="sm|md|lg"]` 區段
- [ ] 6.2 [impl] App.css comment L141 `comfortable` → `default`；L129 `dark` → `clay-dark`
- [ ] 6.3 [impl] Workspace.tsx 移除 `registerActions` 呼叫；CommandPaletteContext 移除 `registerActions`/`paletteActions`
- [ ] 6.4 [impl] CommandPaletteContext 移除 `useCommandPalette()` 合體 hook；MessageList.tsx 改用 `useCommandPaletteState()`
- [ ] 6.5 [impl] Workspace.test.tsx 重命名 3 個含 "SessionBar" 的 test
- [ ] 6.6 [impl] useAvailableWorktrees.ts JSDoc 移除 SessionBar 引用；MobileGapFixes.test.tsx 移除死注解
- [ ] 6.7 [impl] useCommandFeatures.ts search-messages TODO 註解移除（execute 已由 CommandModeView 特殊處理）

## 7. 收尾

- [ ] 7.1 [verify] tsc clean + 全套 vitest green
- [ ] 7.2 [verify] 瀏覽器手動驗證：theme 切換（clay-dark↔light↔roast）、density 切換、mobile/tablet 模擬
