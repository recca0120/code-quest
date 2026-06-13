# dialog-extraction Specification

## Purpose
TBD - created by archiving change workspace-structure-refactor. Update Purpose after archive.
## Requirements
### Requirement: Dialog state 從 Workspace 抽出
每個 dialog（AddProject / Settings / CreateWorktree）自管 open state，Workspace 只透過 trigger function 開啟。

#### Scenario: AddProjectDialog 自管 open
- **WHEN** 使用者觸發 "Add Project"
- **THEN** dialog 開啟
- **AND** Workspace 不持有 `dialogOpen` state

#### Scenario: SettingsDialog 自管 open
- **WHEN** 使用者觸發 settings（gear icon 或快捷鍵）
- **THEN** dialog 開啟
- **AND** Workspace 不持有 `settingsOpen` state

#### Scenario: CreateWorktreeDialog 自管 open
- **WHEN** 使用者觸發 "New Worktree"
- **THEN** dialog 開啟
- **AND** Workspace 不持有 `worktreeDialogOpen` state

#### Scenario: 跨 dialog 流程保持
- **WHEN** CreateWorktreeDialog 建立成功
- **THEN** 仍能正確觸發 pendingSession（開新 session）

### Requirement: Workspace 瘦身
重構後 Workspace.tsx 只管：
- `pendingSession` state（跨 dialog 流動）
- layout 組合（TabProvider + TabContainer + PanePicker）

#### Scenario: Workspace state 數量減少
- **WHEN** 重構完成
- **THEN** Workspace 內的 `useState` 呼叫數 ≤ 3（pendingSession + pickerOpen + pickerQuery）

