## Why

左側導航目前混合了 Project 管理、Worktree 操作和 Git branch 切換三個層次，但缺少 Session 導航，導致使用者需要依賴右鍵選單（mobile/tablet 不可用）才能完成核心操作，且 TabBar 水平空間有限，多 session 時 worktree 歸屬不清楚。

## What Changes

- **BREAKING** 廢除 `TabBar` component — session 切換改由左側 sidebar 承擔
- 左側 sidebar 改為三層結構：Project → Worktree → Session
- Worktree / Session 操作改為 inline `[⋯]` button，mobile 觸發 `BottomSheet`（取代右鍵 context menu）
- Chat Area header 改為 breadcrumb bar（顯示 project / branch / session title）
- 新增 `BottomSheet` component — mobile action sheet 基礎元件
- `GitPane` 移除 `BranchSection` — branch 切換統一由左側 worktree `[⋯]` 負責

## Capabilities

### New Capabilities

- `sidebar-session-navigation`: 左側三層導航（Project → Worktree → Session），Session row 作為 tab switcher，含 status dot、inline `[⋯]` 操作
- `bottom-sheet`: mobile/tablet 用的 action sheet 基礎元件，由 `[⋯]` 按鈕觸發，取代右鍵 context menu
- `chat-breadcrumb`: Chat Area 頂部 breadcrumb bar，顯示 project / branch / session title，含左右 sidebar toggle

### Modified Capabilities

- `mobile-nav`: sidebar 操作入口從右鍵改為 inline `[⋯]` + `BottomSheet`，mobile 可操作性提升

## Impact

- `apps/web/src/components/workspace/TabBar.tsx` — 廢除
- `apps/web/src/components/workspace/TabContainer.tsx` — 移除 TabBar 邏輯，改為 active session 控制
- `apps/web/src/components/workspace/WorkspaceLayout.tsx` — 移除 TabBar 相關 props/邏輯
- `apps/web/src/components/project/ProjectTree.tsx` — 加入 Session 層
- `apps/web/src/components/project/WorktreeChildList.tsx` — 加 Session list + inline `[⋯]` button
- `apps/web/src/components/project/WorktreeRow.tsx` — 加 `[+]` / `[⋯]` inline buttons
- `apps/web/src/components/project/WorktreeContextMenu.tsx` — 保留邏輯，觸發改為 `[⋯]` + BottomSheet
- `apps/web/src/components/chat/ChatView.tsx` — header 改為 breadcrumb bar
- `apps/web/src/components/git/GitPane.tsx` — 移除 `BranchSection`
- `apps/web/src/components/ui/BottomSheet.tsx` — 新建
