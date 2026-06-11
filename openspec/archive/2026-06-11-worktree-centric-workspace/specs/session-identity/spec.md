# session-identity Specification

## Purpose

Session 的 project/worktree 歸屬進入資料模型：建立時整包寫入 TabMeta，顯示層以 cwd 反查 live lookup map（不信快照）。修復「UI 上選 branch、建好後處處顯示不出來」與「breadcrumb 貼錯 project」。

## ADDED Requirements

### Requirement: TabMeta carries full identity at creation

`createNewTab` SHALL accept `projectCwd` and `branch` alongside `cwd`, and write them into `TabMeta`. 呼叫端（SessionBar dropdown、PanePicker、pendingSession 管線）在選擇當下就持有這些值，SHALL 整包傳入。`session:launch` payload SHALL 因此帶上 branch（既有欄位，先前永遠 undefined）。

#### Scenario: new session from a worktree row carries identity

- **WHEN** 使用者從任一 worktree 列（SessionBar [+]／PanePicker）開新 session
- **THEN** `tabs[channelId]` SHALL 含 `cwd`、`projectCwd`、`branch`（來源 worktree 的值）

### Requirement: cwd → identity lookup map（D3）

The system SHALL provide a `useWorktreeLookup()` hook returning `Map<cwd, { branch?, name, projectName, projectCwd }>`，derived from `projects × git listing`（隨 `worktree:branchChanged` 即時更新）。顯示層的 branch/projectName SHALL 優先使用 lookup（checkout 改名不 stale），快照值僅為 fallback。

#### Scenario: branch rename reflects immediately

- **WHEN** 某 worktree checkout 到新 branch（listing 更新）
- **THEN** 所有顯示該 worktree session 的 ⎇ badge SHALL 顯示新 branch，無需重開 session

### Requirement: Breadcrumb project name is per-session

每個 session pane 的 projectName SHALL 由該 session 的 `meta.projectCwd`（或 cwd 反查 lookup）推導，SHALL NOT 使用全域 activeProject 單值灌給所有 pane。

#### Scenario: cross-project session shows its own project

- **WHEN** active project 是 A，而某 pane 顯示 project B 的 session
- **THEN** 該 pane 的 breadcrumb SHALL 顯示 B 的名稱
