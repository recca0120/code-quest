# Remove Session Bar — Tasks

## 1. 分析現有 Consumer

- [ ] 1.1 [impl] 逐一審查 5 個 consumer 對舊系統的依賴點，確認每個呼叫的語意與對應的新系統 API
- [ ] 1.2 [impl] 確認新系統是否有等效的 session busy/status 追蹤機制；若無，先設計補齊方案再開始遷移

## 2. 遷移 WorkspaceTabBar

- [ ] 2.1 [test] 更新 `WorkspaceTabBar` 測試：改用新系統（`paneRoot` + session states）驗證 busy 指示，不再 mock `useTabState`
- [ ] 2.2 [impl] `WorkspaceTabBar`：移除 `useTabState`，改從 `collectSessionsInPaneTree` + 新系統 session state 讀取 busy 狀態

## 3. 遷移 KeyboardShortcutsProvider

- [ ] 3.1 [test] 更新 `KeyboardShortcutsProvider` 測試：`createNewTab` 快捷鍵觸發 `addWorkspaceTab`，讀 tab 數量改從 `workspaceTabs` 取得
- [ ] 3.2 [impl] `KeyboardShortcutsProvider`：`createNewTab` → `addWorkspaceTab`；讀 `tabs` → 讀 `workspaceTabs`；移除 `useTabActions`/`useTabState` import

## 4. 遷移 ChatView

- [ ] 4.1 [test] 更新 `ChatView` 測試：`route.type === 'replace'` 觸發新系統的 pane content 替換 action，不再呼叫 `replaceTab`
- [ ] 4.2 [impl] `ChatView`：將 `replaceTab(oldChannelId, newChannelId)` 替換為新系統對應的 pane content 替換 action；移除 `useTabActions` import

## 5. 遷移 SessionManager

- [ ] 5.1 [test] 更新 `SessionManager` 測試：session 列表改從 `collectSessionsInPaneTree(paneRoot)` 讀取，不再 mock `useTabState`
- [ ] 5.2 [impl] `SessionManager`：移除 `useTabState`，改從 `paneRoot` 與 `workspaceTabs` 組合出 session 列表與 meta

## 6. 遷移 TabContainer（最複雜）

- [ ] 6.1 [test] 更新 `TabContainer` 測試：新 session 建立觸發 `addWorkspaceTab` + pane assignment，不再呼叫 `createNewTab`
- [ ] 6.2 [test] 更新 `TabContainer` 測試：session 關閉觸發新系統的 pane close，不再呼叫 `removeTab`
- [ ] 6.3 [test] 更新 `TabContainer` 測試：session title 更新觸發 `renameWorkspaceTab`，不再呼叫 `setTabTitle`
- [ ] 6.4 [test] 更新 `TabContainer` 測試：session status 變更由新系統 session state 追蹤，不再呼叫 `setTabStatus`
- [ ] 6.5 [impl] `TabContainer`：`createNewTab` → `addWorkspaceTab` + `setSessionInPane`
- [ ] 6.6 [impl] `TabContainer`：`removeTab` → 新系統 pane close action
- [ ] 6.7 [impl] `TabContainer`：`setTabTitle` → `renameWorkspaceTab`
- [ ] 6.8 [impl] `TabContainer`：`setTabStatus` → 新系統 session state 更新機制
- [ ] 6.9 [impl] `TabContainer`：移除 `useTabActions`/`useTabState` import，移除 hidden pools（`inactive-tab-sessions`、`session-pool`）與 `contents` div hack

## 7. 移除舊系統

- [ ] 7.1 [test] 確認所有測試已不再 import 或 mock `useTabState`/`useTabActions`/`TabMeta`
- [ ] 7.2 [impl] 移除 `SessionBar` component 及 `TabBar` component
- [ ] 7.3 [impl] 移除 `TabContext` 中的舊 `tabs` state、`activeTabId`、`useTabState`、`useTabActions`、`TabMeta` 型別、`DEFAULT_META`、`replaceTab` 相關邏輯
- [ ] 7.4 [impl] 移除 `TabContext` 中 sessions-prop effect 裡驅動舊系統的 `removeTab`/`addTab` 呼叫（確認新系統已接管同等邏輯）
- [ ] 7.5 [impl] 清理 `TabContext` export：確認只剩新系統 API（`useWorkspaceTab`、`collectSessionsInPaneTree` 等）

## 8. Refactor 收尾

- [ ] 8.1 [refactor] 全域 grep 確認無剩餘 `useTabState`/`useTabActions`/`createNewTab`/`removeTab`/`replaceTab`/`setTabTitle`/`setTabStatus`/`SessionBar`/`TabBar` 引用
- [ ] 8.2 [refactor] 確認 `TabContext` 職責單純：只剩 workspace tab（tmux window）+ pane tree 管理，無 per-channel metadata 殘留
