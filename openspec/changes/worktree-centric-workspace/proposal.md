# Worktree-Centric Workspace

## Why

2026-06-10 多 agent 設計審查（5 盤點 + 4 批判）確認：**系統資料模型以 cwd 字串為中心，但使用者心智模型是 project → branch/worktree → session**。階層只存在各 UI 的顯示層，每個元件各自用字串比對反推歸屬，造成：

1. 彈出 panel 有 project 但沒有 branch/worktree（CommandPalette Context section 只有 project 名）
2. 開新 session、files/git/openspec pane 都在「選 cwd」而非「選 project 的 worktree」
3. Session 建立後 branch 顯示鏈全斷——UI 上選的是 branch，建好後沒有任何地方顯示得出來
4. 多個 popup panel 功能殘缺（SessionManager 三個 + 按鈕全是 no-op）

證據鏈核心：`SessionBar.tsx:199` `onNewSession(wt.path, ...)` → `TabContainer.tsx:428` 丟棄 projectCwd → `TabContext.tsx:450` createNewTab 只寫 `{ cwd }`（branch 欄位存在但永遠 undefined）→ server 用 git 反推 projectRoot → 三個 UI 用三套規則把 session 歸回 worktree。

## What Changes

### P1 — 階層做進資料模型（治本）

- `TabMeta` 加 `projectCwd` 與 `branch` 欄位；createNewTab 呼叫端（SessionBar dropdown / PanePicker / WorktreesPane）當下都拿著 `project.cwd` 與 `wt.branch`，整包傳入並隨 `session:launch` 帶給 server
- 建立單一 `cwd → { branch, projectName, projectCwd }` lookup map（從 `ProjectContext.projects × GitContext.listing` 衍生，隨 `worktree:branchChanged` 即時更新）
- 歸屬判定收斂成單一 util `resolveSessionWorktree(session, listing)`，取代 PanePicker / SessionManager / SessionBar 各自的字串比對
- ChatBreadcrumb 的 projectName 改 per-session 推導（目前 `TabContainer.tsx:267` 用全域 activeProject 灌給所有 pane，跨 project session 會顯示錯的 project 名）

### P2 — 入口接線修補

- SessionManager（⌘⇧M）接上 onNewSession / onNewWorktree / onAddProject（仿 CommandPaletteContext.registerActions 模式）；cwd→session 索引改一對多
- PanePicker 的 `targetPaneId` 接通（Workspace handler 簽名漏了第三參數，session 會落到錯的 pane）
- CreateWorktreeDialog 加 `onCreated(path)`，從 new-session flow 進入時建完即開 session（目前 dead-end，要從頭導航 8 步）
- Cmd+T / pendingOpenWorktree 的「create + 指派 pane」下沉成 TabContext 單一 action（目前 spawn 看不見的幽靈 session——真的會啟動 CLI process）
- CommandPalette Context section 改 per-worktree features（label「{project} ⎇ {branch}」），加「New session in …」指令
- WorkspaceTabBar 加常駐 context indicator：「{activeProject} ⎇ {預設 worktree}」可點擊切換

### P3 — 元件收斂（中期）

- 以 PanePicker MainView 為基底抽共用 `WorktreePicker` 元件，統一 6 種 worktree 選擇 UI 形態
- Tool pane（git/files/spec）加 `follow: 'focused-session'` 模式；pane cwd 與 focused session 不一致時 toolbar 警示
- `formatWorktreeLabel(wt)` util 統一 `wt.branch ?? wt.name` fallback（4+ 處重複，目錄名會偽裝成 branch）
- WorktreeSwitcher：cwd 不在 listing 時顯示 basename + 警示，永不顯示整條絕對路徑；下拉加 project 分組與 ✓ 標記

## Impact

- **影響範圍**：`TabContext` / `TabContainer` / `SessionBar` / `PanePicker` / `SessionManager` / `KeyboardShortcutsProvider` / `Workspace` / `WorkspaceTabBar` / `CommandPalette` / `WorktreeSwitcher`；schemas 的 `session:launch` payload
- **相依時序**：P2 的「create + 指派 pane 下沉」**必須在 `remove-session-bar` 動工之前完成**，否則 SessionBar 移除後 Cmd+T 的結果完全不可見；`remove-session-bar` 也需先確認 [+] dropdown 的承接方案（proposal 目前把替代方案列為 out of scope）
- **與既有 change 的關係**：`layout-persistence` 的 F3（session leaf 存 cwd）會受益於 TabMeta 的 projectCwd/branch；`navigation-feature` 的 palette 型別設計可直接承載 P2 的 per-worktree features
