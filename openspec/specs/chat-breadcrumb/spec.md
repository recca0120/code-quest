# chat-breadcrumb Specification

## Purpose
TBD - created by archiving change sidebar-navigation-redesign. Update Purpose after archive.
## Requirements
### Requirement: Chat Area breadcrumb bar

Chat Area 頂部 SHALL 渲染 breadcrumb bar，取代原 TabBar，顯示當前 session 的脈絡資訊。

#### Scenario: Breadcrumb 內容（有 worktree）
- **WHEN** active session 有 `cwd`（關聯 worktree）
- **THEN** 顯示 `projectName / ⎇ branchName / sessionTitle`

#### Scenario: Breadcrumb 內容（無 worktree）
- **WHEN** active session 的 `cwd` 為 undefined 或等於 `projectRoot`
- **THEN** 顯示 `projectName / sessionTitle`（省略 branch 部分）

#### Scenario: Session title 截斷
- **WHEN** session title 過長
- **THEN** title 部分以 `truncate` 截斷，不換行

---

### Requirement: Breadcrumb sidebar toggle buttons

Breadcrumb bar 兩側 SHALL 提供 sidebar toggle 按鈕。

#### Scenario: 左側 toggle
- **WHEN** 使用者點擊 breadcrumb bar 左側的 `[☰]` 按鈕
- **THEN** 左側 sidebar 切換 open/close（呼叫 `onToggleLeft`）

#### Scenario: 右側 toggle
- **WHEN** 使用者點擊 breadcrumb bar 右側的 `[▥]` 按鈕，且 session 有 `cwd`
- **THEN** 右側 RightPane 切換 open/close（呼叫 `onToggleRight`）
- **WHEN** session 無 `cwd`
- **THEN** `[▥]` 按鈕不顯示（RightPane 不存在）

---

### Requirement: GitPane BranchSection 移除

`GitPane` SHALL NOT 渲染 `BranchSection`（branch 切換功能移至左側 Worktree `[⋯]`）。

#### Scenario: BranchSection 不存在
- **WHEN** GitPane 渲染且 git status 已載入
- **THEN** DOM 中不存在 branch popover trigger（`aria-label="branch-section"` 或等效元素）

