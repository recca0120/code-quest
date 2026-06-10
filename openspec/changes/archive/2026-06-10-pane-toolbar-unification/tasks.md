## 1. Pane compound component（TDD）

- [x] 1.1 新增 `Pane.test.tsx`：從 `PaneHeader.test.tsx` 搬移，進入點改為 `<Pane.Toolbar>`，所有 expect 不動
- [x] 1.2 建立 `Pane.tsx`（`Pane.Toolbar` + `Pane.Content`），通過 1.1 測試
- [x] 1.3 確認 `Pane.test.tsx` 全綠

## 2. WorktreeSwitcher standalone component（TDD）

- [x] 2.1 新增 `WorktreeSwitcher.test.tsx`：從 `ToolPaneHeader.test.tsx` 搬移，進入點改為 `<WorktreeSwitcher>`；T.4 的 textContent expect 改為抓按鈕本身，其餘不動
- [x] 2.2 建立 `WorktreeSwitcher.tsx`（從 `ToolPaneHeader` 提取），通過 2.1 測試
- [x] 2.3 確認 `WorktreeSwitcher.test.tsx` 全綠

## 3. TabContainer 改用 Pane compound component

- [x] 3.1 修改 `TabContainer.tsx`：leaf render 改用 `Pane` + `Pane.Toolbar` + `Pane.Content`
- [x] 3.2 session pane：`Pane.Toolbar` 無 children（只有 split/close）
- [x] 3.3 git / files / spec pane：`Pane.Toolbar` 包 `WorktreeSwitcher`
- [x] 3.4 確認 `TabContainer.test.tsx` 全綠（零修改）

## 4. 移除舊元件

- [x] 4.1 刪除 `PaneHeader.tsx` 與 `PaneHeader.test.tsx`
- [x] 4.2 從 `ToolPanes.tsx` 移除 `ToolPaneHeader`、`GitPane`、`FilesPane`、`SpecPane`（保留 `WorktreesPane`）
- [x] 4.3 刪除 `ToolPaneHeader.test.tsx`
- [x] 4.4 全域 grep 確認無殘留 import

## 5. 整合驗證

- [x] 5.1 執行 `pnpm test --filter @cc-office/web` 全綠
