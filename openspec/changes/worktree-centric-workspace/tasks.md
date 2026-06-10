# Worktree-Centric Workspace — Tasks

本輪範圍：P1（session-identity spec）＋ P2 接線（entry-wiring spec）。
P2 UI 增強與 P3 收斂列於 §5-§6 留後。共用 TabMeta 型別——單線依序，不可平行 agent。

## 1. P1 — Session identity（session-identity spec）

- [x] 1.1 [test] `createNewTab({ cwd, projectCwd, branch })` — meta 寫入三欄
- [x] 1.2 [impl] TabMeta 加 `projectCwd?`；createNewTab opts 擴充；pendingSession 管線（Workspace→TabContainer→handleCreateTab）與 SessionBar dropdown 傳入 projectCwd/branch
- [x] 1.3 [test] `useWorktreeLookup()` — projects × listing 推導 Map<cwd, identity>；listing 變更時更新
- [x] 1.4 [impl] useAvailableWorktrees.ts 加 `useWorktreeLookup`（同源衍生）
- [x] 1.5 [test] SessionPane breadcrumb — 跨 project session 顯示自己的 project 名（非 activeProject）
- [x] 1.6 [impl] SessionPane/SessionPool 的 projectName 改 per-session 推導（meta.projectCwd ?? lookup(meta.cwd)，activeProject 僅 fallback）
- [x] 1.7 [test] SessionBar ⎇ badge — 優先 lookup(cwd).branch（checkout 改名即時反映），meta.branch fallback
- [x] 1.8 [impl] SessionBar/SessionManager 顯示層接 lookup

## 2. P2 — D6 create+place 下沉（entry-wiring spec）

- [x] 2.1 [test] `useCreateSessionInPane` — 空 pane 填入／占用 split／focused 為 tool pane 不吞（既有 handleCreateTab 測試遷移語意）
- [x] 2.2 [impl] 抽 `useCreateSessionInPane` hook（compose tab+pane contexts）；TabContainer.handleCreateTab 改用
- [x] 2.3 [test] Cmd+T — 新 session 可見落 pane（split-pane-leaf 數增加）
- [x] 2.4 [impl] KeyboardShortcutsProvider 的 Cmd+T 走 hook
- [x] 2.5 [test] pendingOpenWorktree intent — 消費後 session 落 pane（不進隱形 pool）
- [x] 2.6 [impl] intent 消費從 TabProvider 搬到 TabContainer（同時消 pendingActivateChannel 的 pane 指派缺口：activate 的 channel 不在 pane 時 setSessionInPane）

## 3. P2 — SessionManager 接線

- [x] 3.1 [test] ⌘⇧M「+ New session」— 經 pendingSession 管線建立並落 pane
- [x] 3.2 [impl] KeyboardShortcutsProvider props { onNewSession?, onNewWorktree?, onAddProject? } 由 Workspace 傳入並轉交 SessionManager；onNewSession 簽名帶 projectCwd
- [x] 3.3 [test] 同 worktree 兩個 sessions — Projects 區列出兩個＋恆常「+ New session」
- [x] 3.4 [impl] cwdToSessionId 改 cwd → sessionId[]；「+ New session」不與既有 session 互斥

## 4. P2 — targetPaneId ＋ worktree 建立接續

- [x] 4.1 [test] 空 pane 的 picker 建立 session 落在該 pane（非 focused pane）
- [x] 4.2 [impl] Workspace pendingSession 加 targetPaneId；TabContainer effect 傳 handleCreateTab
- [x] 4.3 [test] CreateWorktreeDialog onCreated — new-session flow 進入時建完即開 session
- [x] 4.4 [impl] dialog 加 onCreated(path)；Workspace 記錄來源 intent，接 pendingSession

## 5. P2 UI 增強（留後）

- [ ] 5.1 CommandPalette Context section 改 per-worktree features（「{project} ⎇ {branch}」）＋「New session in …」指令
- [ ] 5.2 WorkspaceTabBar 常駐 context indicator（{activeProject} ⎇ {預設 worktree}，可點擊切換）

## 6. P3 — 元件收斂（留後）

- [ ] 6.1 以 PanePicker MainView 為基底抽共用 WorktreePicker，六種入口統一
- [ ] 6.2 tool pane follow:'focused-session' 模式（wire 已預留 target.kind）
- [ ] 6.3 formatWorktreeLabel util 統一 `branch ?? name` fallback（4+ 處）
- [ ] 6.4 WorktreeSwitcher：cwd 不在 listing 顯示 basename＋警示；下拉 project 分組＋✓
