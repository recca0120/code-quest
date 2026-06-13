## Why

Workspace.tsx 管 5 個 dialog 的 open state（`dialogOpen`、`settingsOpen`、`worktreeDialogOpen`、`panePickerOpen`、`pickerInitialQuery`），每個都有對應的 setter + handler，佔了約 40% 的 Workspace 程式碼。抽出後 Workspace 只管核心的 layout 組合。

屬於主 change `workspace-structure-refactor` 的 Phase 1 子 change。

## What Changes

建立 `WorkspaceDialogsContext`，將 dialog open state 和 trigger 集中管理。Workspace 改為透過 context 觸發 dialog。

## Capabilities

### New Capabilities
- `workspace-dialogs`: WorkspaceDialogs context 集中管理 dialog open/close

### Modified Capabilities

## Impact

- `apps/web/src/contexts/WorkspaceDialogsContext.tsx` (新檔)
- `apps/web/src/components/workspace/Workspace.tsx` — 移除 dialog state
- `apps/web/src/components/workspace/WorkspaceDialogs.tsx` (新檔) — dialog 渲染
