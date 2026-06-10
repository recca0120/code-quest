# Remove Session Bar — Proposal

## Problem Statement

Codebase 目前並行維護兩套 tab 系統，造成狀態管理複雜度與技術債：

**舊系統（歷史債）：**
- `TabContext` 裡的 `tabs: Record<channelId, TabMeta>`、`activeTabId`
- `useTabState()`、`useTabActions()`（`createNewTab`、`removeTab`、`replaceTab`、`setTabTitle`、`setTabStatus`）
- `SessionBar` + `TabBar` components（UI）
- `TabContainer` 裡的 hidden pools（`inactive-tab-sessions`、`session-pool`）
- `TabContainer` 裡的 `contents` div hack（用於 SessionBar 寬度測量）

**新系統（已存在）：**
- `workspaceTabs: WorkspaceTab[]`、`activeWorkspaceTabId`
- `useWorkspaceTab()`（`addWorkspaceTab`、`removeWorkspaceTab`、`switchWorkspaceTab`、`renameWorkspaceTab`）
- `WorkspaceTabBar` component
- `SplitPane` + `PaneLeaf`

兩套系統同時存在導致：每個 consumer 都要知道要讀哪個系統、狀態同步容易出錯、新功能開發時心智負擔高。

## Solution Summary

將所有 consumer 從舊系統遷移至新系統，讓新系統成為 workspace 狀態唯一的 source of truth，再完整移除舊系統。

遷移策略：
- `WorkspaceTabBar`：改從新系統（`collectSessionsInPaneTree` + 各 pane 的 session states）讀取 session busy 狀態，不再依賴 `tabs[id].tabStatus`
- `KeyboardShortcutsProvider`：`createNewTab` → `addWorkspaceTab`；讀 `tabs` → 讀新系統的 `workspaceTabs`
- `ChatView`：`replaceTab`（更新 session 標題）→ 改用新系統的 `renameWorkspaceTab` 或對應 action
- `SessionManager`：讀 `tabs` 顯示 session 列表 → 改從 `paneRoot`（`collectSessionsInPaneTree`）與新系統讀取
- `TabContainer`：最複雜，session 生命週期管理（`createNewTab`、`removeTab`、`setTabTitle`、`setTabStatus`）全面遷移至新系統

## Scope

**In scope：**
- 遷移 5 個 consumer：`WorkspaceTabBar`、`KeyboardShortcutsProvider`、`ChatView`、`SessionManager`、`TabContainer`
- 移除 `SessionBar` component 及其依賴的 `TabBar` component
- 移除 `TabContext` 中的舊 `tabs` 系統：`useTabState`、`useTabActions`、`TabMeta` 型別、`DEFAULT_META`
- 移除 `TabContainer` 中的 hidden pools（`inactive-tab-sessions`、`session-pool`）
- 移除 `TabContainer` 中的 `contents` div hack
- 清理所有相關測試，確保測試直接驗證新系統行為

**Out of scope：**
- SessionBar UI 功能的替代方案（另立 change 處理）
- WorkspaceTabBar 的視覺/UX 改版
- session busy 狀態的新訂閱機制設計（由 TabContainer 遷移決定）

## Dependencies

此 change 必須在 `layout-persistence` change 完成後才能實作，因為 layout persistence 讓新系統（`workspaceTabs` + pane tree）成為 workspace 狀態的 source of truth，是本 change 能安全移除舊系統的前提。

## Risks

- **Session 狀態遺失**：舊系統的 `tabStatus`（`connecting`、`busy`、`idle` 等）若無對應的新系統機制，遷移後 `WorkspaceTabBar` 的 busy 指示將失效。需確認新系統有等效的 session state 追蹤。
- **replaceTab 語意**：`ChatView` 用 `replaceTab(oldChannelId, newChannelId)` 在 session replace 時更新 tab，新系統需要有等效的 pane content 替換 action，否則 pane 內容會殘留舊 channelId。
- **TabContainer 複雜性**：舊系統在 `TabContainer` 裡承擔 session 生命週期管理（create/remove/update），遷移過程須確保不遺漏任何副作用，特別是 `createNewTab` 呼叫點與 `removeTab` 呼叫點。
