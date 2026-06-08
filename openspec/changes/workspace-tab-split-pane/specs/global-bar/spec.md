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
- **THEN** Global Bar 顯示 active project 的名稱（basename of cwd）

#### Scenario: 展開 project switcher
- **WHEN** 使用者點擊 project 名稱
- **THEN** 展開 dropdown，列出所有 project，active project 有 ✓ 標示

#### Scenario: 切換 project
- **WHEN** 使用者在 dropdown 中選擇另一個 project
- **THEN** active project 切換，sidebar worktree list 更新為新 project 的 worktrees

#### Scenario: 新增 project
- **WHEN** 使用者點擊 dropdown 中的「Add project」
- **THEN** 開啟 AddProjectDialog

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
