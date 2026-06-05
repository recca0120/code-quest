## Why

左側 sidebar 的 WorktreeSessionList 與右側 TabBar 顯示相同的 session 資料，造成重複。同時，TabBar 目前以 project 為單位顯示所有 sessions，在多個 worktree 並行開發時缺乏聚焦，使用者無法快速定位到特定 worktree 的工作。

## What Changes

- **移除** WorktreeSessionList（sidebar 中 worktree 下方的 session 條目列表）
- **新增** worktree 選取狀態：點擊 sidebar 的 worktree row 會選中該 worktree
- **修改** TabBar 過濾邏輯：TabBar 只顯示當前選中 worktree 的 sessions
- **新增** 導航記憶：記住每個 project 上次選的 worktree、每個 worktree 上次看的 tab
- **修改** 點擊 project 的行為：展開後自動回到上次選的 worktree（無記錄則選第一個）

## Capabilities

### New Capabilities

- `worktree-tab-filter`: TabBar 按選中的 worktree 過濾 sessions，點 worktree 切換過濾範圍
- `navigation-memory`: 記住每個層級的上次狀態（project → worktree、worktree → tab），切換時自動還原

### Modified Capabilities

## Impact

- `WorktreeSessionList.tsx` — 移除
- `WorktreeChildList.tsx` — worktree row 加入 selected 狀態與點擊處理
- `NavigationContext.tsx` — 加入 `lastWorktreeByProject` 與 `lastTabByWorktree` 兩個 Map
- `TabContainer.tsx` / `TabBar.tsx` — 接收 worktree filter，只渲染該 worktree 的 tabs
- `WorkspaceLayout.tsx` — 串接 navigation memory 與 tab filter 邏輯
