# sidebar-session-navigation Specification

## Purpose
TBD - created by archiving change sidebar-navigation-redesign. Update Purpose after archive.
## Requirements
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

點擊 Session row SHALL 切換 active session（等同 TabBar 切換 tab），不重新 mount session 的 React 子樹。點擊後 TabBar 上對應的 tab 應變為 active。

#### Scenario: 點擊 session row 切換 active
- **WHEN** 使用者點擊非 active 的 session row
- **THEN** chat area 切換至該 session；TabBar 上對應 tab 變為 active highlight

#### Scenario: Active session row highlight
- **WHEN** session 為 active（channelId 與 TabBar active tab 相同）
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

### Requirement: TabBar 保留（sidebar 與 TabBar 共存）

TabBar SHALL 顯示於 chat area 頂部。sidebar session list 與 TabBar 共存，兩者都可切換 active session。

#### Scenario: TabBar 顯示於 chat 上方
- **WHEN** workspace 渲染且有 open sessions
- **THEN** TabBar 顯示在 chat content 上方，列出所有 open sessions

#### Scenario: Worktree row 不顯示 live session badge
- **WHEN** worktree row 渲染
- **THEN** WorktreeRow 不顯示 live session 數量 badge（已由 sidebar session list 呈現，badge 為冗餘資訊）

---

### Requirement: Project row 點擊只展開，不收合

點擊 Project card（非 chevron 區域）SHALL 只展開 worktree 列表，不收合。收合操作僅限 chevron 按鈕。

#### Scenario: 點擊已展開的 Project 不收合
- **WHEN** project worktree 列表已展開
- **AND** 使用者點擊 Project card（非 chevron）
- **THEN** worktree 列表維持展開狀態（不收合）；active project 更新

#### Scenario: 點擊未展開的 Project 展開列表
- **WHEN** project worktree 列表未展開
- **AND** 使用者點擊 Project card
- **THEN** worktree 列表展開；active project 更新

#### Scenario: Chevron 仍可 toggle
- **WHEN** 使用者點擊 chevron 按鈕
- **THEN** 展開/收合狀態切換（toggle）

---

### Requirement: session history 入口

SessionHistoryPopover 入口保留在 sidebar worktree context menu（"Open past session…"）。

