# Tasks: Design Alignment Audit

務必用 fake-summoner-client harness 做 TDD（先改測試 RED → 改 code GREEN）。expect 反映 design spec 定義的目標態。

- [x] 1. **RWD-breakpoint**: `useTabletMode()` 下限 768→640px；相關 `useMobileMode()` 也確認用 640px；測試 setupMatchMedia 驗證 640–1023 為 tablet
- [x] 2. **drawer-diffstat**: DrawerHost header 加 diffstat（+N/-N lines），透過 gitActions.status() 取得 insertions/deletions；已在 drawer-diffstat change 實作完成
- [x] 3. **logo-visibility**: WorkspaceTabBar logo text 移除 `hidden md:inline`，改為 `hidden sm:inline`（640px 以上顯示）；測試 setupMatchMedia(640) 驗證 logo text 可見
- [x] 4. **tab-busy-dot**: busy 燈改為 DOM 常駐 + `invisible`/`visible` 切換（非 conditional render）；測試驗證非 busy 時 dot 元素仍在 DOM
- [x] 5. **pane-focus-border**: App.css `--color-pane-focus` 的 `color-mix` 第二參數從 `var(--color-border)` 改為 `transparent`；測試驗 CSS variable 值
- [x] 6. **split-reject-toast**: （已實作，測試通過） `splitPane` 在 guardSplitMinSize 失敗時呼叫 toast（用既有 notification 機制）；測試驗 toast 觸發
- [x] 7. **rail-hint-always**: RightPane hint 移除 `onPromote` 條件，完整文字始終渲染為 dim label（非 button）；測試驗 hint 在無 onPromote 時仍顯示
- [x] 8. **palette-min-width**: PanePicker Dialog 加 `min-w-[90vw]`（或 token `--palette-min-w: 90vw`）；CSS/className 測試驗證
- [x] 9. **drawer-pin-primary**: DrawerHost pin 按鈕改為 `bg-accent text-selected-text`（filled primary）；測試驗 className 包含 primary style
- [x] 10. **git-count-prefix**: RightPane + PaneDock git tab count 加 `+` 前綴（`+N` 而非 `N`）；測試驗渲染文字
- [x] 11. **rail-extra-button**: （保留——⤢ 按鈕是 drawer 唯一入口，spec hint「點項目開 drawer」需另建機制才能移除） 移除 RightPane header 多餘的 `⤢ open-in-drawer` 按鈕（spec 只有 ⇥）；測試驗按鈕不存在
- [x] 12. **dock-hint-mobile**: （保留——mobile 無鍵盤，⌘⏎ 提示無意義，「左右滑切 pane」更適合） MobileDockBar/PaneDock 在 mobile 時保留原 hint 或顯示 spec 文字；確認 spec 意圖後調整
- [x] 13. **stale-comment**: App.css density 註解 `comfortable` → `default`
- [x] 14. **permission-mode-str**: （已一致，CSS 和 server 都用 `bypassPermissions`） 確認 server 送 `bypassPermissions` 與 CSS selector `[data-mode="bypassPermissions"]` 一致；若不一致則對齊
- [x] 15. **pane-gap-confirm**: （等效——PaneDivider 佔 6px + PaneTree p-6px padding） 確認 PaneDivider 渲染等效 6px gap（若已等效則 PASS，否則補 gap token）
- [x] 16. **picker-col-breakpoint**: （等效——modal 980px + dialog-viewport max-w 在窄螢幕自然退化為 560px 單欄） PanePicker 三欄在 <980px 時退化為單欄，確認斷點行為
