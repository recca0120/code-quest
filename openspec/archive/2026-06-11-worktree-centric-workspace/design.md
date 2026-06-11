# Worktree-Centric Workspace — Design Notes

## Context

本文件記錄 2026-06-10 設計審查的完整發現（含 file:line 證據），作為後續 component 討論的依據。審查方法：5 個 reader 平行盤點（navigation panel / session 建立 / tool panes cwd / layout persistence / spec 意圖），4 個批判角度（概念模型一致性 / 操作流程摩擦 / 狀態持久化預期 / 資訊呈現辨識度）。

layout persistence 的 P0 修正記在 `openspec/changes/layout-persistence/`（design.md Review Findings + tasks.md §9-12），本 change 處理其餘。

---

## 現狀盤點

### 入口地圖（開 project / worktree / session 的所有路徑）

| 入口 | 觸發 | 顯示階層 | 問題 |
|---|---|---|---|
| CommandPalette Context | mod+k | 只有 project 名 | 無 branch/worktree；切完無回饋；無 new-session 指令 |
| SessionBar [+] dropdown | 點擊 | project → ⎇ worktree | 用 projectName **顯示字串**分組配對（`SessionBar.tsx:190`）；屬 remove-session-bar 要刪的系統 |
| PanePicker（Open in pane） | 空 pane / EmptyState | project → ⎇ worktree → sessions + 工具 | 資訊最完整，但只能從空 pane 進入；targetPaneId 被 Workspace 丟棄 |
| SessionManager（⌘⇧M / ⊞） | 快捷鍵 | tab 分組 + project → worktree | 三個 + 按鈕全 no-op（只傳 onClose，`KeyboardShortcutsProvider.tsx:183`）；一個 worktree 最多顯示一個 session（`Map<cwd, sessionId>` last-write-wins） |
| WorktreesPane | pane 內 | project → worktree | 不在 PersistedLayout schema（layout-persistence F2） |
| WorktreeSwitcher | tool pane toolbar | 扁平跨 project「⎇ branch (project)」 | 無分組無 ✓；cwd 不在 listing 時顯示整條絕對路徑（`WorktreeSwitcher.tsx:34-35`） |

同一個「選 worktree」概念有 **6 種 UI 形態**，testid 也分裂（`new-session-dropdown` vs `cwd-dropdown`）。

### 「目前位置」的三套互不同步 state

| State | 粒度 | 現況 |
|---|---|---|
| `ProjectContext.activeProjectCwd` | project | 決定 TabProvider scope、新 session 預設 cwd、breadcrumb projectName |
| `NavigationContext.activeCwd` | cwd | TabContainer 由 focused pane 回寫（`TabContainer.tsx:320-323`） |
| `NavigationContext.selectedWorktreeCwd` | per-project worktree | **writer 已死**——唯一寫入者 WorktreeChildList 未掛載（sidebar archive 遺留），但仍留在 createNewTab 的 fallback 鏈 `opts.cwd ?? selectedCwd ?? cwd`（`TabContext.tsx:452`） |

另外 Cmd+T 用 `KeyboardShortcutsProvider.tsx:55-61` 自己算的 focusedLeafCwd，不是 activeCwd——「跟隨 focus 的 cwd」有兩套平行實作。

### Session 身分鏈斷裂

1. `TabContext.tsx:450-462` createNewTab 不設 `TabMeta.branch`（欄位存在、永遠 undefined）→ SessionBar 的 ⎇ badge 對新 session 不顯示
2. `ChannelContext.tsx:64-66` launch payload 只在 meta.branch 有值才帶 → server `connect.ts:244` `ch.branch` 永遠 undefined
3. `channel-manager.ts:141` `opts.worktree` 全 server 無 production caller
4. `TabContainer.tsx:267` projectName 取全域 activeProject 灌給**所有** pane → 跨 project session 貼錯標籤
5. server 端 title（generate_title）只進 SessionContext，不回寫 TabMeta → 同一 session 在 SessionBar 與 PanePicker 顯示兩個名字；無 title 時 fallback 是 UUID（`SessionBar.tsx:96`）

### Dormant 程式碼

`components/project/` 整個目錄（ProjectTree / TopScopeSwitcher / WorktreeChildList / BranchPopover …）在 live app 零引用——來自已 archive 的 sidebar-navigation-redesign，只有 ChatBreadcrumb 存活。`navigation-feature` change 講的是 CommandPalette 的 NavigationFeature 型別，完全未實作。

---

## Decisions（待討論定案）

### D1. 單一 location 模型

把三套 state 收斂成 `NavigationContext.currentLocation: { projectCwd, worktreeCwd }`：
- `worktreeCwd` 由 focused pane 或使用者明確選擇更新
- `activeProjectCwd` 變衍生值
- 刪除 `selectedWorktreeCwd`（死狀態）與 `activeCwd`；KeyboardShortcutsProvider 的 focusedLeafCwd 改讀同一來源
- 所有「預設開在哪」「breadcrumb 顯示什麼」從這一個物件出發

### D2. TabMeta 帶完整身分

`TabMeta` 加 `projectCwd` + `branch`，建立時由呼叫端整包傳入（選擇來源本來就是 worktree 清單，資料當場可得）。顯示層**不要信快照**——branch 用 cwd 反查 lookup map（worktree:branchChanged 即時更新，checkout 改名不會 stale；WorktreeSwitcher 已是這個模式）。

### D3. cwd → identity lookup map

`TabContainer.tsx:362-373` 已組好 availableWorktrees（path/branch/projectName），收斂成 `Map<cwd, { branch, projectName, projectCwd }>` 放進 context 或 hook，供 SessionBar ⎇ badge、ChatBreadcrumb、SessionManager、WorktreeSwitcher 共用。同時解決 SessionBar 用顯示字串分組的問題（WorktreeOption 加 projectCwd 欄位）。

### D4. WorktreePicker 共用元件

以 PanePicker MainView 為基底（●/○ live 標記 + ⎇ branch + sessions + 工具按鈕），資料統一吃 `projects × listing`。CommandPalette / SessionManager / SessionBar 入口全部重用。SessionBar 屬 remove-session-bar 要刪的系統，遷移時順勢收斂。

### D5. Tool pane follow 模式

> **Shape 定版註記（2026-06-10）**：序列化與 client content 的形狀以 `pane-tree-named-components` D1 的 `target: { kind:'fixed'; cwd } | { kind:'follow' }` 為準（wire v2 已預留，命名為 `openspec` 非 `spec`）；下文的 `follow:'focused-session'` 僅為語意描述，非欄位形狀。

PaneContent 的 git/files/spec 增加 `follow: 'focused-session'` variant，渲染時 cwd 即時解析自 focused session 的 `tabs[sessionId].cwd`。WorktreeSwitcher 下拉頂部加「Follow focused session」。pane cwd 與 focused session 不一致時 toolbar 警示色。序列化存 marker 而非 cwd。

> 對照組：RightPane 已自動跟 session 的 meta.cwd（`RightPane.tsx:35-74`），模式正確，只是獨立 tool pane 沒有等價物。
> 風險佐證：git pane 的 discardFile 等破壞性操作綁 pane cwd（`GitView.tsx:24-34`），與相鄰 session 脫鉤時有在錯誤 worktree 操作的實害。

### D6. createSessionInPane 下沉（⚠ 時序敏感）

TabContainer.handleCreateTab 的「create + 空 pane 填入 / 占用則 splitPaneAndAssign」（`TabContainer.tsx:281-300`）下沉到 TabContext 成單一 action；Cmd+T 與 pendingOpenWorktree 消費端都改走它。**必須在 remove-session-bar 之前完成**——目前幽靈 session 的唯一線索是 SessionBar 多一個 tab。

---

## 流程摩擦實測（修正前 baseline）

| 任務 | 現況 | 目標 |
|---|---|---|
| (a) 新 worktree 開 session | 8 步、第 7 步靠記憶找剛打的 branch 名（dialog 成功後 dead-end） | 建完即開（onCreated → pendingSession 管線） |
| (b) 看某 worktree 的 git 狀態 | 空 pane 按鈕寫「New Session」但開的是萬用 picker；WorktreeSwitcher 扁平無分組 | 按鈕改名「Open…」；picker 的 git/files/spec 與 + New Session 同層 |
| (c) 兩個 session 對照 | Cmd+T spawn 幽靈 session（hidden pool 照樣啟動 CLI） | D6 |
| (d) reload 回到工作狀態 | pane 骨架在、session 全拆綁、無 cwd 提示；開過 worktrees pane 則全部歸零 | layout-persistence F2/F3 |

---

## Open Questions（component 討論的起點）

1. **WorktreePicker 的形態**：Dialog（現 PanePicker）vs Popover（dormant TopScopeSwitcher 骨架）vs 常駐 sidebar？remove-session-bar 之後 [+] dropdown 的承接是哪一個？
2. **PanePicker 常駐入口**：WorkspaceTabBar 加按鈕（與 ⊞ 並列）或 CommandPalette 註冊 action？目前 pane 全滿時唯一完整入口無法打開。
3. **SessionManager 與 PanePicker 是否合併**：兩者都列 project→worktree→session，功能重疊度高；SessionManager 修好接線後還有存在必要嗎？
4. **dormant components/project/ 的處置**：TopScopeSwitcher 骨架可復用於 D1 的常駐 context indicator，其餘是否刪除？
5. **EmptyState 按鈕語意**：「New Session」改「Open…」，或拆成兩個 action？
