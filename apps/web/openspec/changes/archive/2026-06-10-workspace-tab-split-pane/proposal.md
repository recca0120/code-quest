## Why

使用者以 `cd <dir> && claude` 的方式啟動，並用 tmux 管理多個工作 context，需要在同一個 claude 視窗內並排查看多個 session、以及在不同 worktree 之間切換——目前 UI 只能一次顯示一個 session，無法滿足平行工作流程。

## What Changes

- **BREAKING** 廢除 `WorkspaceTopbar` component，全域操作（search、settings、project switcher）移至新的 `GlobalBar`
- **BREAKING** Tab 的職責改變：Tab = Session（1:1），不再是「active session 切換器」，而是「session 清單 + 視窗填充工具」
- 新增 Split Pane 系統：chat 區域支援任意方向、任意深度的視窗切割（binary tree 結構）
- 新增 Pane Header：每個 pane 顯示 branch / session title，含左右切、上下切、關閉 pane 按鈕
- 新增 Global Bar：頂部一列，顯示 project switcher、search、settings
- Tab Bar 重新設計：只負責列出所有 session + 新增 session，點擊 tab 填入 focused pane
- Left Sidebar 瘦身：只保留 Worktree List（含 per-worktree `[+]` 新增 session）+ 底部全域操作
- Right Pane 行為調整：跟隨 focused pane 的 cwd，而非 active tab 的 cwd

## Capabilities

### New Capabilities

- `split-pane`: Chat 區域的視窗切割系統——binary tree 結構，支援任意方向與深度，含 focus model、resize、空白 pane session picker
- `global-bar`: 頂部全域列——project switcher（多 repo 支援）、search、settings 入口
- `pane-header`: 每個 split pane 的標題列——顯示 branch + session title，含切割與關閉按鈕

### Modified Capabilities

- `sidebar-session-navigation`: Session 層從 sidebar 移除，改由 Tab Bar 統一管理；Sidebar 只保留 Worktree List + 底部全域操作
- `mobile-nav`: Split pane 在 mobile 退化為單 pane；sidebar / right pane 維持 slide-in drawer

## Impact

- `apps/web/src/components/workspace/WorkspaceLayout.tsx` — 加入 GlobalBar，移除 WorkspaceTopbar
- `apps/web/src/components/workspace/WorkspaceTopbar.tsx` — 廢除，邏輯拆入 GlobalBar
- `apps/web/src/components/workspace/TabContainer.tsx` — Tab Bar 重新設計，加入 SplitPaneRoot
- `apps/web/src/components/workspace/TabBar.tsx` — 行為調整（tab = session，點擊填入 focused pane）
- `apps/web/src/components/workspace/SplitPaneRoot.tsx` — 新建，管理 pane tree state
- `apps/web/src/components/workspace/SplitPane.tsx` — 新建，遞迴 pane 元件
- `apps/web/src/components/workspace/PaneHeader.tsx` — 新建，每個 pane 的標題列
- `apps/web/src/components/workspace/GlobalBar.tsx` — 新建
- `apps/web/src/components/project/WorktreeChildList.tsx` — 移除 session list 層，保留 worktree row + `[+]`
- `apps/web/src/contexts/TabContext.tsx` — 加入 pane tree state 與 focusedPaneId
