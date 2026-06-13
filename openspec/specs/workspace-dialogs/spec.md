# workspace-dialogs Specification

## Purpose
TBD - created by archiving change dialog-extraction. Update Purpose after archive.
## Requirements
### Requirement: WorkspaceDialogsContext dialog triggers
系統 SHALL 提供 `WorkspaceDialogsContext`，暴露 `openAddProject`、`openSettings`、`openCreateWorktree(projectCwd)` 三個 action。

#### Scenario: openAddProject 開啟 AddProjectDialog
- **WHEN** 呼叫 `openAddProject()`
- **THEN** AddProjectDialog 顯示（open=true）

#### Scenario: openSettings 開啟 SettingsDialog
- **WHEN** 呼叫 `openSettings()`
- **THEN** SettingsDialog 顯示（open=true）

#### Scenario: openCreateWorktree 開啟 CreateWorktreeDialog
- **WHEN** 呼叫 `openCreateWorktree('/path/to/project')`
- **THEN** CreateWorktreeDialog 顯示，且 cwd 為傳入的 projectCwd

#### Scenario: dialog 關閉後 state 歸零
- **WHEN** 任一 dialog 的 onClose 觸發
- **THEN** 該 dialog 的 open state 歸 false

### Requirement: Workspace dialog state removal
Workspace.tsx MUST NOT 直接持有 `dialogOpen`、`settingsOpen`、`worktreeDialogOpen` 三個 useState。

#### Scenario: Workspace useState 數量
- **WHEN** 重構完成
- **THEN** Workspace 的 useState 不包含 dialog open 相關的 state（只保留 pendingSession 和 picker 相關）

#### Scenario: 既有功能不變
- **WHEN** 使用者透過各入口觸發 dialog
- **THEN** dialog 行為與重構前完全相同（開啟、操作、關閉）

