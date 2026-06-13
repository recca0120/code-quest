## Context

Workspace.tsx 目前有 6 個 `useState`：
- `dialogOpen` — AddProjectDialog
- `settingsOpen` — SettingsDialog
- `worktreeDialogOpen` — CreateWorktreeDialog
- `panePickerOpen` — PanePicker modal
- `pickerInitialQuery` — PanePicker 的初始搜尋字串
- `pendingSession` — 跨 dialog 流程（worktree 建完 → 開 session）

加上 `openInPaneTargetPaneId`（PanePicker 的 target pane）。

## Goals / Non-Goals

**Goals:**
- 將 AddProject / Settings / CreateWorktree 三個 dialog 的 open state 從 Workspace 移出
- Workspace 只保留 `pendingSession`（跨 dialog 流程）和 PanePicker 相關 state
- 不改變任何 dialog 的視覺或行為

**Non-Goals:**
- 不改變 PanePicker 的 state 管理（它與 pendingSession 緊密耦合，留在 Workspace）
- 不改變 dialog 元件自身的實作
- 不引入 global state manager（Zustand 等）

## Decisions

### D1: WorkspaceDialogsContext

建一個 context 提供 dialog trigger：
```tsx
interface WorkspaceDialogsActions {
  openAddProject: () => void;
  openSettings: () => void;
  openCreateWorktree: (projectCwd: string) => void;
}
```

state + actions 分離（照專案慣例）。actions 端的 `openCreateWorktree` 接受 `projectCwd` 參數（原本由 `setActiveProject` + `setWorktreeDialogOpen` 組成）。

### D2: WorkspaceDialogs 元件

新建 `WorkspaceDialogs` 元件，在 context 內部渲染三個 dialog。放在 `Workspace.tsx` 裡 `TabProvider` 外（dialog 是 portal，位置不影響視覺）。

### D3: 依賴方向

- `Workspace` → `useWorkspaceDialogsActions()` 取得 trigger
- `WorkspaceDialogs` 內部持有 open state + 渲染 dialog
- `WorkspaceTabBar`、`PanePicker` 的 `onAddProject` / `onOpenSettings` / `onNewWorktree` 改為呼叫 context actions

### D4: pendingSession 流程保持

`CreateWorktreeDialog.onCreated(path)` → `setPendingSession(...)` 這條跨 dialog 流程留在 Workspace（不進 context）。WorkspaceDialogs 透過 `onWorktreeCreated(path)` callback 回報，Workspace 接到後設 pendingSession。

## Risks / Trade-offs

- 多一層 context，但交換的是 Workspace 少 3 個 useState + 對應 handler
- dialog 渲染從 Workspace 搬到 WorkspaceDialogs，但都是 portal 所以 DOM 位置不變
