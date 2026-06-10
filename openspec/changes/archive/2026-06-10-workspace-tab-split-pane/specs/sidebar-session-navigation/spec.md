## MODIFIED Requirements

### Requirement: Worktree row inline 操作按鈕

Worktree row SHALL 提供 `[+]` 和 `[⋯]` inline 按鈕。`[+]` 在該 worktree 的 cwd 建立新 session 並加入 Tab Bar；session 不自動填入任何 pane，由使用者決定顯示位置。

#### Scenario: [+] 按鈕建立 session
- **WHEN** 使用者點擊 worktree row 的 `[+]` 按鈕
- **THEN** 在該 worktree 的 cwd 建立新 session，新 session 出現於 Tab Bar
- **AND** 新 session 填入目前 focused pane（若 focused pane 為空白）或成為 Tab Bar 未 active 的 tab（若 focused pane 已有 session）

#### Scenario: [⋯] 按鈕開操作選單
- **WHEN** 使用者點擊 `[⋯]`，且為 desktop（`isDesktop === true`）
- **THEN** 顯示 Dropdown menu（Switch branch / Rename / Archive / Delete / Copy path）
- **WHEN** 使用者點擊 `[⋯]`，且為 non-desktop
- **THEN** 顯示 BottomSheet，內容相同

## REMOVED Requirements

### Requirement: 左側三層結構 — Project → Worktree → Session

**Reason**: Session 層從 sidebar 移除，統一由 Tab Bar 管理。Sidebar 只保留 Worktree List，減少導航層次，避免 session 切換有兩個入口（Tab Bar 和 sidebar session list）造成混淆。

**Migration**: Session 切換改由 Tab Bar 操作；session 狀態（status dot）改顯示於 Tab Bar 的 tab 上。

### Requirement: Session row 作為 tab switcher

**Reason**: Tab Bar 點擊行為改為「填入 focused pane」，sidebar session row 的 tab 切換職責由 Tab Bar 統一承擔。兩個入口並存會造成行為不一致。

**Migration**: 使用 Tab Bar 上的 session tab 切換 / 填入 pane。
