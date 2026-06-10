# workspace-chrome Spec

## ADDED Requirements

### Requirement: 頂部 tab bar（tmux windows）

tab bar SHALL 依 handoff §1 渲染：左 logo、編號 tabs（mono 編號、busy 燈、名稱、×、nowrap）、＋ 新增、右側 ⊞ Session Manager（⌘⇧M）/⌘K 鍵帽/⚙。tab 的 busy 燈 SHALL 在該 tab pane tree 內任一 session busy 時亮起（pulse），聚合用 `collectSessionsInPaneTree`。

#### Scenario: tab busy 燈聚合
- **WHEN** tab B 的某個 pane 內 session 進入 processing
- **THEN** tab B 顯示 busy 燈；該 session 結束且 tab 內無其他 busy 時熄滅

#### Scenario: 單擊切換、雙擊改名
- **WHEN** 使用者單擊 tab（含 label 文字區）
- **THEN** 切換至該 tab（修正既有 stopPropagation bug）
- **WHEN** 雙擊 label
- **THEN** 進入 rename 編輯（沿用既有 rename 機制）

### Requirement: tab 預設命名 = 第一個 pane 的 worktree 名

新 tab 的預設 label SHALL 為其第一個 pane 的 worktree 名（去 `feat/` 等前綴）；使用者改過名的 tab SHALL NOT 被自動命名覆寫；layout 還原時既有 label 不變。

#### Scenario: 預設命名
- **WHEN** 在新 tab 開啟 worktree `feat/discuss-layout` 的 session
- **THEN** tab label 顯示 `discuss-layout`

### Requirement: 底部狀態列

狀態列 SHALL 常駐顯示 focused pane 的 `project ⎇ branch`（經 `useWorktreeLookup` 反查 focused leaf cwd）、右側快捷鍵提示（與 KeyboardShortcutsProvider 綁定單一來源）與 `N busy` 聚合。

#### Scenario: focused pane 決定狀態列 context
- **WHEN** focus 從 project A 的 pane 切到 project B 的 pane
- **THEN** 狀態列顯示 B 的 `project ⎇ branch`

### Requirement: SessionBar 移除

SessionBar 與其 overflow/maxVisible 邏輯 SHALL 移除。busy 可見性 SHALL 由 tab 燈＋狀態列承接。SessionBar 的行為測試 SHALL 等價遷移（busy 聚合、session 切換入口改 picker/manager），不可無聲刪除覆蓋。

#### Scenario: busy 無 SessionBar 仍可見
- **WHEN** 任一 session busy 且 SessionBar 不存在
- **THEN** 對應 tab 亮燈且狀態列顯示 `1 busy`
