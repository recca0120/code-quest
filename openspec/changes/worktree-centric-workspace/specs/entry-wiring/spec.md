# entry-wiring Specification

## Purpose

修復「開新 session」各入口的斷線：SessionManager 假按鈕、PanePicker targetPaneId 被丟、建 worktree 後 dead-end、create+place 邏輯下沉（D6，remove-session-bar 前置）。

## Requirements

### Requirement: SessionManager actions are wired

SessionManager（⌘⇧M）的「+ New session」「+ New worktree」「+ Add project」SHALL 連接實際 handlers（由 Workspace 經 KeyboardShortcutsProvider props 傳入）。Projects 區 SHALL 列出每個 worktree 的**全部** sessions（一對多，非 last-write-wins），且「+ New session」對已有 session 的 worktree 仍然可用。

#### Scenario: new session from SessionManager

- **WHEN** 使用者在 ⌘⇧M panel 點某 worktree 的「+ New session」
- **THEN** SHALL 經 pendingSession 管線建立 session 並落入 pane（非 no-op）

#### Scenario: a worktree with two sessions lists both

- **WHEN** 同一 worktree 有兩個 live sessions
- **THEN** Projects 區該 worktree 列 SHALL 顯示兩個 session 連結＋一個恆常的「+ New session」

### Requirement: PanePicker targetPaneId reaches placement

從空 pane 開啟 PanePicker 建立的 session SHALL 落在**該** pane：`targetPaneId` SHALL 隨 pendingSession 一路傳到 create+place。

#### Scenario: empty pane's picker fills that pane

- **WHEN** pane X（空）的「New Session」開啟 picker、使用者選 worktree 建立
- **THEN** session SHALL 出現在 pane X（focused pane 不動）

### Requirement: Worktree creation flows into session creation

`CreateWorktreeDialog` SHALL expose `onCreated(path)`；由 new-session flow（SessionBar dropdown／PanePicker）進入時，建立成功 SHALL 直接以新 worktree 開 session（終結 8 步 dead-end）。

#### Scenario: create worktree then session in one flow

- **WHEN** 使用者從 new-session dropdown 點「+ New worktree」並完成建立
- **THEN** SHALL 自動以新 worktree 的 path 建立 session 並落入 pane

### Requirement: create+place is a single shared operation（D6）

「建立 session ＋ 指派 pane（空 pane 填入／占用則 split／tool pane 不吞）」SHALL 收斂為單一共用 hook（`useCreateSessionInPane`）。Cmd+T 與 `pendingOpenWorktree` intent 消費 SHALL 走同一條路——session SHALL NOT 落入隱形 pool（幽靈 session 終結；remove-session-bar 的前置）。

#### Scenario: Cmd+T lands in a pane

- **WHEN** 使用者按 Cmd+T
- **THEN** 新 session SHALL 可見地出現在 pane（split 或填空），不依賴 SessionBar 顯示
