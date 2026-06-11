# Behavior Quick Fix — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. ⌘K 鍵帽可點擊

- [ ] 1.1 [test] renderWithWorkspace：點擊 ⌘K 鍵帽 → PanePicker 開啟（queryByTestId pane-picker-miller）
- [ ] 1.2 [impl] WorkspaceTabBar.tsx：`<span>` → `<button onClick={onOpenPicker}>`，需新增 onOpenPicker prop 或從 context 取得

## 2. ⚙ 按鈕常駐

- [ ] 2.1 [test] renderWithWorkspace：⚙ 按鈕永遠存在（不依賴 onOpenSettings prop）
- [ ] 2.2 [impl] WorkspaceTabBar.tsx：移除 `{onOpenSettings &&` 條件，改為永遠渲染；無 handler 時 disabled

## 3. Tab 去前綴邏輯

- [ ] 3.1 [test] deriveTabLabel：branch `feat/scope/name` → 回傳 `scope/name`（不只取 `name`）
- [ ] 3.2 [test] deriveTabLabel：branch `main`（無前綴）→ 回傳 `main`
- [ ] 3.3 [test] deriveTabLabel：branch `fix/hotfix`（單層前綴）→ 回傳 `hotfix`
- [ ] 3.4 [impl] deriveTabLabel：改為只移除第一段已知前綴（feat/fix/chore/hotfix/release/bugfix），保留其餘

## 4. PanePicker 開啟預設聚焦欄

- [ ] 4.1 [test] PanePicker open → 欄1 有 data-active（預設選中第一個 project）
- [ ] 4.2 [impl] PanePicker.tsx：`setCol(2)` → `setCol(0)`

## 5. ⏎ 在欄1/2 的 guard

- [ ] 5.1 [test] PanePicker 焦點在欄1 → ⏎ → 移動焦點到欄2（不開 session）
- [ ] 5.2 [test] PanePicker 焦點在欄2 → ⏎ → 移動焦點到欄3（不開 session）
- [ ] 5.3 [impl] handleKeyDown Enter：`col < 2` 時 `setCol(col + 1)` 而非 activate

## 6. Mobile ⊞ 單 pane guard

- [ ] 6.1 [test] renderWithWorkspace + mobile：只有 1 pane → 點 ⊞ → PanePicker 開啟（非卡片牆）
- [ ] 6.2 [impl] MobilePaneWall：`leaves.length < 2` 時仍渲染 ⊞（改由 TopBar 的 onOpenWall 觸發 picker），或 MobileTopBar 的 ⊞ 在 1 pane 時直接開 picker

## 7. font-size statusline 短暫提示

- [ ] 7.1 [test] renderWithWorkspace：⌘= 後 statusline 短暫顯示字級文字（如 "Font: L"）
- [ ] 7.2 [impl] KeyboardShortcutsProvider + WorkspaceStatusline：font-size 變更時發 event/state → statusline 暫態顯示 2s 後消失

## 8. Tablet portrait condensed strip

- [ ] 8.1 [test] renderWithWorkspace + tablet portrait + 3 pane → CondensedPaneStrip 渲染（顯示第三個 pane 的 chip）
- [ ] 8.2 [impl] useVisiblePaneIds：portrait 模式下仍計算 condensed（visible = primary + slide-over focused，其餘 condensed）
- [ ] 8.3 [impl] PaneTree：portrait 模式下 CondensedPaneStrip 可渲染（目前被 PortraitSlideOver 繞過）

## 9. 收尾

- [ ] 9.1 [verify] tsc clean + 全套 vitest green
- [ ] 9.2 [verify] 瀏覽器手動驗證上述 8 項行為
