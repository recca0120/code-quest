## 1. BottomSheet component（新建，無破壞性）

- [x] 1.1 建立 `apps/web/src/components/ui/BottomSheet.tsx`：`BottomSheet` + `BottomSheetItem`，使用 Radix `Dialog` 實作，固定底部，含 drag handle 視覺、overlay 關閉、Escape 關閉
- [x] 1.2 撰寫 `apps/web/src/components/ui/__tests__/BottomSheet.test.tsx`：open/close、overlay 點擊關閉、Escape 關閉、destructive variant 樣式、children 渲染

## 2. ChatBreadcrumb component（新建，無破壞性）

- [x] 2.1 建立 `apps/web/src/components/chat/ChatBreadcrumb.tsx`：顯示 `projectName / ⎇ branch / title`（無 cwd 時省略 branch），含左右 `[☰]` / `[▥]` toggle 按鈕
- [x] 2.2 撰寫 `apps/web/src/components/chat/__tests__/ChatBreadcrumb.test.tsx`：有/無 cwd 時的 breadcrumb 內容、toggle 按鈕回呼、`[▥]` 在無 cwd 時不顯示

## 3. WorktreeRow inline 操作按鈕

- [x] 3.1 `WorktreeRow.tsx` 加入 `[+]` 按鈕（`aria-label="Open new chat"`）與 `[⋯]` 按鈕（`aria-label="Worktree actions"`）作為 props/slots
- [x] 3.2 撰寫 / 更新 `WorktreeRow` 測試：`[+]` 點擊呼叫 `onOpenNewChat`，`[⋯]` 按鈕存在

## 4. WorktreeChildList Session 層 + BottomSheet 整合

- [x] 4.1 `WorktreeChildList.tsx` 在每個 worktree 下加入 Session list：從 `useSession()` filter `cwd === worktree.path`，不顯示 `exited` session
- [x] 4.2 Session row 顯示 status dot + title，點擊呼叫 `setActiveTab(sessionId)`（使用 `useTabActions`）
- [x] 4.3 Session row 加入 `[⋯]` 按鈕：desktop → dropdown（Close / Rename），mobile → BottomSheet
- [x] 4.4 Worktree `[⋯]` 操作：desktop 繼續用 `WorktreeDropdownMenu`，mobile 改用 `BottomSheet`（`useBreakpoint().isDesktop` 判斷）
- [x] 4.5 撰寫 `WorktreeChildList` 整合測試：session row 顯示、點擊切換 active session、`[+]` 按鈕、mobile 下 `[⋯]` 顯示 BottomSheet

## 5. TabContainer 移除 TabBar

- [x] 5.1 `TabContainer.tsx` 移除 `<TabBar>` render，保留 `Tabs.Root` + `Tabs.Content forceMount` 機制不變
- [x] 5.2 `TabContainer.tsx` 移除 `rightOpen` state 的 TabBar 相關邏輯（rightOpen 本身保留，供 RightPane toggle）
- [x] 5.3 確認 `TabContext` 的 `activeTabId` / `setActiveTab` 仍正常運作（由左側 session row 觸發）

## 6. ChatView header 換成 ChatBreadcrumb

- [x] 6.1 `ChatView.tsx` 移除原 `HeaderBar`，改用 `ChatBreadcrumb`，傳入 `onToggleLeft` / `onToggleRight` / breadcrumb 資料
- [x] 6.2 更新 `apps/web/src/components/chat/__tests__/ChatView.test.tsx`：原 HeaderBar 相關 assertion 改為 ChatBreadcrumb，確認 toggle 按鈕行為

## 7. GitPane 移除 BranchSection

- [x] 7.1 `GitPane.tsx` 移除 `<BranchSection>` 及相關 state（`branchPopoverOpen`、`branches`）和 `handleBranchOpenChange` 函式
- [x] 7.2 `GitPane.test.tsx` 刪除 "selecting a branch from the popover triggers git checkout" 等 BranchSection 相關 test cases（行為消失，不反轉 assertion）

## 8. 測試大規模更新（配合 TabBar 廢除）

- [x] 8.1 更新 `apps/web/src/test/render-with-workspace.tsx`：`launchSession` 改為點擊左側 sidebar 的 `[+]` 按鈕（worktree row），移除 `New tab` button 依賴
- [x] 8.2 更新 `WorkspaceLayout.test.tsx`：移除所有 `tab-bar` / `New tab` / `TabBar` 相關 assertions，改用左側 session row 的 aria-label 查詢；新增「TabBar 不存在於 DOM」的 regression test
- [x] 8.3 刪除 `apps/web/src/components/workspace/__tests__/TabBar.test.tsx`（component 廢除，測試一併刪除）

## 9. 刪除 TabBar.tsx

- [x] 9.1 所有測試通過後，刪除 `apps/web/src/components/workspace/TabBar.tsx`；確認無其他 import

## 10. Session history 入口遷移

- [x] 10.1 左側 sidebar 底部（或 ProjectCard `[⋯]` 內）加入 "Session history" 入口，觸發原 `SessionHistoryPopover`
- [x] 10.2 撰寫測試：點擊入口顯示 SessionHistoryPopover
