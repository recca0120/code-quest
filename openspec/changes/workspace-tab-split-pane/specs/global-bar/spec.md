## ADDED Requirements

### Requirement: Global Bar 常駐頂部
Global Bar SHALL 固定顯示於 workspace 最頂部，高度 36px，所有 viewport 寬度下皆可見。

#### Scenario: 頂部常駐
- **WHEN** workspace 載入
- **THEN** Global Bar 顯示於最頂部，不隨捲動消失

---

### Requirement: Sidebar Toggle
Global Bar SHALL 提供 `[☰]` 按鈕，展開或收合左側 sidebar。

#### Scenario: 展開 sidebar
- **WHEN** sidebar 為收合狀態，使用者點擊 `[☰]`
- **THEN** sidebar 展開顯示

#### Scenario: 收合 sidebar
- **WHEN** sidebar 為展開狀態，使用者點擊 `[☰]`
- **THEN** sidebar 收合隱藏

#### Scenario: 鍵盤快捷鍵
- **WHEN** 使用者按 `⌘⌥S`
- **THEN** sidebar 切換展開 / 收合狀態

---

### Requirement: Project Switcher
Global Bar SHALL 顯示目前 active project 名稱，點擊後展開 project switcher dropdown，列出所有已加入的 project 及新增入口。

#### Scenario: 顯示目前 project
- **WHEN** workspace 載入
- **THEN** Global Bar 顯示 active project 的名稱（basename of cwd）；無 active project 時顯示「No project」

#### Scenario: 展開 project switcher
- **WHEN** 使用者點擊 project 名稱
- **THEN** 展開 dropdown，列出所有 project，active project 有 ✓ 標示

#### Scenario: 切換 project
- **WHEN** 使用者在 dropdown 中選擇另一個 project
- **THEN** active project 切換

#### Scenario: 新增 project
- **WHEN** 使用者點擊 dropdown 中的「Add project」
- **THEN** 開啟 AddProjectDialog

---

### Requirement: New Session Picker（Grouped by Project）
Global Bar `[+]` SHALL 展開一個 grouped picker，列出**所有** project 的 worktrees，無論目前是否有 active project。

#### Data Model
- 一個 Project 擁有一組 Worktrees（`git worktree list` 結果）
- Worktree 路徑不保證是 project root 的子目錄
- Session 所屬 project 透過 `listing[projectCwd]` 決定，**不用路徑前綴比對**

#### Scenario: 無 active project 時仍可開 session
- **WHEN** 使用者點擊 `[+]`，且目前無 active project
- **THEN** picker 仍顯示所有 project 及其 worktrees，使用者可直接選擇

#### Scenario: Grouped 顯示所有 projects
- **WHEN** 使用者點擊 `[+]`
- **THEN** picker 以 project 為單位分組，每組顯示 project 名稱 + 該 project 的所有 worktrees + `[+ New worktree]`

#### Scenario: 選擇 worktree 開 session
- **WHEN** 使用者選擇某個 worktree
- **THEN** 開新 session，cwd 為該 worktree path；active project 自動切換為該 worktree 所屬 project

#### Scenario: Per-project 新增 worktree
- **WHEN** 使用者點擊某 project 的 `[+ New worktree]`
- **THEN** 開啟針對該 project 的 CreateWorktreeDialog

#### Scenario: Worktree 尚未載入
- **WHEN** listing 尚未 load 完畢
- **THEN** picker 仍顯示 project 名稱，worktree 部分顯示 loading 狀態

---

### Requirement: Search 入口
Global Bar SHALL 提供 `[🔍]` 按鈕，點擊後開啟 Command Palette。

#### Scenario: 點擊開啟 Command Palette
- **WHEN** 使用者點擊 `[🔍]`
- **THEN** Command Palette 開啟

#### Scenario: 鍵盤快捷鍵
- **WHEN** 使用者按 `⌘K`
- **THEN** Command Palette 開啟

---

### Requirement: Settings 入口
Global Bar SHALL 提供 `[⚙]` 按鈕，點擊後開啟 Settings dialog。

#### Scenario: 點擊開啟 Settings
- **WHEN** 使用者點擊 `[⚙]`
- **THEN** Settings dialog 開啟
