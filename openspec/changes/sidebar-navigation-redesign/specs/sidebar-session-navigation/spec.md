## ADDED Requirements

### Requirement: 左側三層結構 — Project → Worktree → Session

左側 sidebar SHALL 以三層展開結構呈現：Project 為頂層，每個 Project 展開後顯示其 Worktree 列表，每個 Worktree 展開後顯示歸屬的 Session 列表。

#### Scenario: Project 層顯示
- **WHEN** 左側 sidebar 渲染
- **THEN** 每個 project 顯示名稱，active project 有 highlight 樣式

#### Scenario: Worktree 層顯示 git 摘要
- **WHEN** project 展開且 worktree 有 git status
- **THEN** worktree row 顯示 branch 名稱、changed files count（`M3` 格式）、ahead/behind（`↑1 ↓0`）

#### Scenario: Session 層歸屬
- **WHEN** worktree 展開
- **THEN** 只顯示 `state !== 'exited'` 且 `cwd === worktree.path` 的 session；`cwd === projectRoot` 的 session 歸屬於 main worktree

---

### Requirement: Session row 作為 tab switcher

點擊 Session row SHALL 切換 active session（等同原 TabBar 切換 tab），不重新 mount session 的 React 子樹。

#### Scenario: 點擊 session row 切換 active
- **WHEN** 使用者點擊非 active 的 session row
- **THEN** chat area 切換至該 session，左側 session row 顯示 active highlight

#### Scenario: Active session row highlight
- **WHEN** session 為 active
- **THEN** session row 有視覺 highlight（bg-accent/10 或等效）

#### Scenario: Status dot
- **WHEN** session 的 state 為 `busy`
- **THEN** session row 左側顯示 pulsing dot（accent 色）
- **WHEN** state 為 `idle`
- **THEN** 顯示 static dot（success 色）

---

### Requirement: Worktree row inline 操作按鈕

Worktree row SHALL 提供 `[+]` 和 `[⋯]` inline 按鈕，取代右鍵 context menu 作為主要操作入口。

#### Scenario: [+] 按鈕開新 chat
- **WHEN** 使用者點擊 worktree row 的 `[+]` 按鈕
- **THEN** 在該 worktree 開啟新 session（等同原 "Open in new chat"）

#### Scenario: [⋯] 按鈕開操作選單
- **WHEN** 使用者點擊 `[⋯]`，且為 desktop（`isDesktop === true`）
- **THEN** 顯示 Dropdown menu（Switch branch / Rename / Archive / Delete / Copy path）
- **WHEN** 使用者點擊 `[⋯]`，且為 non-desktop
- **THEN** 顯示 BottomSheet，內容相同

#### Scenario: Session row [⋯]
- **WHEN** 使用者點擊 session row 的 `[⋯]`
- **THEN** desktop → Dropdown，mobile → BottomSheet，選項為 Close session / Rename

---

### Requirement: TabBar 廢除

系統 SHALL NOT 渲染 TabBar component。

#### Scenario: TabBar 不存在於 DOM
- **WHEN** workspace 渲染且有 open sessions
- **THEN** DOM 中不存在 `role="tablist"` 且 `aria-label="tab-bar"` 的元素

---

### Requirement: session history 入口

原 TabBar 上的 session history（`☰`）入口 SHALL 移至左側 sidebar。

#### Scenario: 開啟 session history
- **WHEN** 使用者點擊 sidebar 內的 session history 按鈕
- **THEN** 顯示 SessionHistoryPopover（行為與原 ☰ 相同）
