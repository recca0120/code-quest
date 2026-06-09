## Phase 1：Tab + Split Pane 核心驗證

> 目標：證明 Tab（tmux window）+ Split Pane 操作合理。
> 開發方式：嚴格 TDD — Red → Green → Refactor，Feature Test 優先。
> 完成後再決定 Phase 2 的優先順序。

---

### 0. Branch 資訊傳遞（先做，後續 pane header 依賴）

> `session:launch` payload 加入 `branch`，讓前端在開 session 時把 branch 帶給 server，
> server 存到 channel 後透過 `session:states` broadcast 回前端。

- [x] 0.1 [test] `sessionLaunchPayloadSchema` 加 `branch?: string`，現有測試不壞
- [x] 0.2 [impl] `packages/schemas` — `sessionLaunchPayloadSchema` 加 `branch: z.string().optional()`
- [x] 0.3 [test] `sessionStateSummarySchema` 加 `branch?: string`，現有測試不壞
- [x] 0.4 [impl] `packages/schemas` — `sessionStateSummarySchema` 加 `branch: z.string().optional()`
- [x] 0.5 [test] server `handleLaunch` 收到 branch → 存到 channel
- [x] 0.6 [impl] `apps/server` — `handleLaunch` 把 payload.branch 存到 `channel.branch`（Channel 加 `branch` 欄位）
- [x] 0.7 [test] `broadcastSessionState` 帶出 channel.branch
- [x] 0.8 [impl] `apps/server` — `broadcastSessionState` 的 `pickDefined` 加 `branch: ch?.branch`
- [x] 0.9 [test] 前端 `TabMeta` 加 `branch?: string`，`session:states` 收到 branch 時更新
- [x] 0.10 [impl] `apps/web` — `TabContext` 的 `TabMeta` 加 `branch?: string`，同步 `session:states` 事件
- [x] 0.11 [test] `ChannelProvider` 加 `branch` prop，`session:launch` payload 包含 branch
- [x] 0.12 [impl] `apps/web` — `ChannelContext` 的 `launch()` 把 `branch` prop 帶入 emit；`TabContainer` 傳 `meta.branch`
- [x] 0.13 [refactor] 確認所有現有測試綠燈

---

### 1. TabContext 擴充

- [x] 1.1 [test] 寫 `TabContext` 型別測試：`PaneContent`、`PaneNode` 型別正確
- [x] 1.2 [impl] 定義 `PaneContent`（`session | git | files | spec | worktrees`）、`PaneNode`（`leaf | split`）
- [x] 1.3 [test] 寫 `splitPane` action 測試：leaf → split node，新 pane 為空白 leaf
- [x] 1.4 [test] 寫 `closePane` action 測試：關閉 pane 後 sibling 取代 parent；唯一 pane 時 no-op
- [x] 1.5 [test] 寫 `focusPane` action 測試：`focusedPaneId` 更新
- [x] 1.6 [test] 寫 `updateRatio` action 測試：指定 split node 的 ratio 更新，其餘 tree 不動
- [x] 1.7 [test] 寫 `setSessionInPane` action 測試：leaf content 的 sessionId 更新
- [x] 1.8 [test] 寫 `zoomPane` action 測試：`zoomedPaneId` 設定與清除
- [x] 1.9 [test] 寫 `addTab` / `removeTab` / `switchTab` action 測試（現有 sync.test.tsx 已覆蓋）
- [x] 1.10 [impl] 實作所有 pane actions，讓 1.3–1.8 的測試通過
- [x] 1.11 [impl] `usePaneActions` / `usePaneState` hooks，隔離 pane tree re-render

### 2. SplitPane 元件

- [x] 2.1 [test] Feature test：render 單一 session pane，顯示 session 內容
- [x] 2.2 [test] Feature test：切割後顯示兩個 pane，各自顯示正確 content
- [x] 2.3 [test] Feature test：`zoomedPaneId` 存在時，其他 pane 不可見，zoomed pane 全寬
- [x] 2.4 [impl] 建立 `SplitPane`（遞迴 render `PaneNode`）+ `SplitPaneLeaf`
- [x] 2.5 [impl] `direction: 'h' | 'v'` 以 flexbox 排列；`ratio` 計算兩側尺寸
- [x] 2.6 [impl] zoom：`zoomedPaneId` 非 null 時非 zoomed pane `hidden` 屬性

### 3. PaneHeader

- [x] 3.1 [test] session pane header 顯示 `⎇ branch · title`
- [x] 3.2 [test] 空白 pane header 顯示空白或提示文字
- [x] 3.3 [test] 點擊 `[⊟]` 呼叫 `splitPane('h')`
- [x] 3.4 [test] 點擊 `[⊞]` 呼叫 `splitPane('v')`
- [x] 3.5 [test] 點擊 `[×]` 呼叫 `closePane`；唯一 pane 時按鈕 disabled
- [x] 3.6 [test] focused pane 顯示 `data-focused` 屬性
- [x] 3.7 [test] zoomed 狀態顯示 `[⊠ zoomed]` 指示
- [x] 3.8 [impl] 實作 `PaneHeader`，讓 3.1–3.7 測試通過

### 4. Resize

- [x] 4.1 [test] 拖曳分隔線後 `onRatioChange` callback 被呼叫
- [x] 4.2 [test] divider 有正確 `data-direction` 屬性
- [x] 4.3 [impl] 建立 `PaneDivider`，`onPointerDown` → `setPointerCapture` → `pointermove` → `pointerup`

### 5. Pane Zoom

- [x] 5.1 [test] `⌘⇧Z` 觸發 `zoomPane(focusedPaneId)`；已 zoom 時觸發 `zoomPane(null)`
- [x] 5.2 [test] zoom 後 zoomedPaneId 設定正確；再按一次清除
- [x] 5.3 [impl] `PaneZoomProvider` 綁定 `⌘⇧Z`，讓 5.1–5.2 測試通過

### 6. Tab Bar（tmux window）

- [x] 6.1 [test] Feature test：新增 tab → Tab Bar 出現新 tab，pane area 切換到新 pane tree
- [x] 6.2 [test] Feature test：`WorkspaceTabBar` render 正確數量 tab
- [x] 6.3 [test] Feature test：關閉 tab → tab 消失
- [x] 6.4 [test] tab 顯示 busy indicator 當該 tab 內有 running session（Phase 2）
- [x] 6.5 [test] tab 標題雙擊進入 inline rename（Phase 2）
- [x] 6.6 [impl] 切換 tab 時 paneRoot 各自獨立（per-tab pane tree 在 wsState 中）
- [x] 6.7 [impl] 建立 `WorkspaceTabBar` 元件，讓 6.1–6.3 測試通過

### 7. Session Tab Bar（C）

- [x] 7.1 [test] 點擊 inactive session tab → 填入 `focusedPane`
- [x] 7.2 [test] 點擊 active session tab（已在某 pane）→ focus 移到該 pane（Phase 2）
- [x] 7.3 [test] session tab 三種狀態樣式：focused-active / active / inactive
- [x] 7.4 [test] Session Bar `[+]` 在 focused pane 的 cwd 開新 session（Phase 2）
- [x] 7.5 [impl] 建立 `SessionBar` 元件，讓 7.1, 7.3 測試通過
- [x] 7.6 [test] session tab 顯示 `●/○` status dot（busy 時 ●，其他 ○）
- [x] 7.7 [test] session tab 顯示 `⎇ branch`（有 branch 時）
- [x] 7.8 [test] session tab 有 `×` close 按鈕，點擊後 session 關閉（closeSession + removeTab）
- [x] 7.9 [impl] SessionBar 補完：status dot + branch + close，讓 7.6–7.8 測試通過

### 8. 空白 Pane Picker

- [x] 8.1 [test] 空白 pane 顯示 picker，列出所有 inactive session
- [x] 8.2 [test] picker 列出「New session in」各 worktree 快速入口（Phase 2）
- [x] 8.3 [test] 選 session → `setSessionInPane`；pane 顯示該 session
- [x] 8.4 [test] 選 new session → 開新 session 並填入此 pane（Phase 2）
- [x] 8.5 [impl] 建立 `EmptyPanePicker`，讓 8.1, 8.3 測試通過

### 10. Global Bar（A）— 取代 WorkspaceTopbar + Sidebar

> 設計 Non-Goals：固定左側 Sidebar。Project list 改由 Global Bar 的 project switcher dropdown 提供。

- [x] 10.1 [test] Global Bar 顯示 active project 名稱
- [x] 10.2 [test] 點擊 project name → 展開 dropdown，列出所有 projects；`✓` 標示 active
- [x] 10.3 [test] dropdown 選擇 project → `setActiveProject`
- [x] 10.4 [test] dropdown 有 `[+ Add project]` 入口
- [x] 10.5 [test] Global Bar `[+]` 展開 worktree quick picker，列出 active project 的 worktrees
- [x] 10.6 [test] worktree quick picker 選 worktree → `createNewTab({ cwd })`
- [x] 10.7 [test] Global Bar `[🔍]` 呼叫 `openPalette()`
- [x] 10.8 [test] Global Bar `[⚙]` 呼叫 `openSettings()`
- [x] 10.9 [impl] 建立 `GlobalBar` 元件，讓 10.1–10.8 測試通過
- [x] 10.10 [impl] `WorkspaceLayout` 換成 `GlobalBar`，移除 `WorkspaceTopbar` 與固定側欄 `DrawerAside`；`[+]` picker 加入 `New worktree` 入口取代 ProjectCard 右鍵

### 9. 整合與收尾

- [x] 9.1 [test] Feature test：完整流程 — 開新 tab → 切割 pane → 填入 session → zoom → 切換 tab
- [x] 9.2 [impl] `TabContainer` 換成 `SplitPane` + `SessionBar` 架構，移除 `Tabs.Root`；session 直接渲染在 pane leaf，未分配 session 以 hidden pool forceMount
- [x] 9.3 [impl] forceMount：未分配 session 以 `display:none` hidden div 維持掛載；分配後直接渲染在 split pane leaf（Phase 2 改用 portal）
- [x] 9.4 [impl] 移除舊的單 session `Tabs.Content` active 切換邏輯；`SessionBar` 點擊 → 填入 focused pane；`handleCreateTab` 同步建立 + 分配
- [x] 9.5 [refactor] 確認所有測試綠燈：269 files, 2313 tests passed ✓

---

## Phase 2：Tool Pane & Context Panel

> 前提：Phase 1 驗證完，確認 split pane 操作合理後再做。

### Phase 1 延期補齊

- [x] 6.4 [test] tab 顯示 busy indicator `●` 當該 tab 內有 running session
- [x] 6.5 [test] tab 標題雙擊進入 inline rename
- [x] 7.2 [test] 點擊 active session tab（已在某 pane）→ focus 移到該 pane，不重複填入
- [x] 7.4 [test] Session Bar `[+]` 在 focused pane 的 cwd 開新 session
- [x] 8.2 [test] Empty Pane Picker 列出「New session in」各 worktree 快速入口
- [x] 8.4 [test] Empty Pane Picker 選 new session → 開新 session 並填入此 pane

### Session Tab Bar overflow

- [x] C.1 [test] session tab 超出寬度時右側顯示 `»N` overflow 按鈕，N 為隱藏數量
- [x] C.2 [test] 點擊 `»N` 展開選單，列出所有隱藏的 session；點擊行為與直接點 tab 相同
- [x] C.3 [impl] 實作 SessionBar overflow，讓 C.1–C.2 測試通過

### Keyboard Shortcuts

- [x] K.1 [test] `⌘T` 在 focused pane 的 cwd 開新 session（無 cwd 時 fallback active project）
- [x] K.2 [test] `⌘W` 關閉 focused pane（唯一 pane 時 no-op）
- [x] K.3 [test] `⌘\` 將 focused pane 左右切割
- [x] K.4 [test] `⌘-` 將 focused pane 上下切割
- [x] K.5 [test] `⌘⌥ ←/→/↑/↓` 將 focus 移到相鄰 pane
- [x] K.6 [impl] 實作 keyboard shortcuts provider，讓 K.1–K.5 測試通過

### Tool Pane

- [x] T.1 [test] 空白 pane picker 加入 tool 選項（Git / Files / Spec / Worktrees）
- [x] T.2 [test] 選 tool → 建立對應 content type 的 pane（`{ type: 'git', cwd }` 等）
- [x] T.3 [test] Tool Pane 開啟時 cwd 預設為 focused session 的 cwd；無 focused session 時 fallback active project cwd
- [x] T.4 [test] Tool Pane header 顯示 emoji + cwd switcher dropdown（`🌿 Git ⎇main ▾`）
- [x] T.5 [test] cwd switcher 切換後 pane content 的 cwd 更新
- [x] T.6 [impl] 建立 `GitPane` / `FilesPane` / `SpecPane` / `WorktreesPane` 元件，讓 T.1–T.5 測試通過
- [x] T.7 [impl] `SplitPane` renderLeaf 加入 tool pane 渲染分支

### Context Panel

- [x] E.1 [test] session pane header 顯示 `[📁][🌿][📋]` toolbar
- [x] E.2 [test] 點擊 toolbar icon → 該 pane 右側展開 context panel，顯示對應 tool tab
- [x] E.3 [test] context panel 的 cwd 自動跟隨該 session（無需手動指定）
- [x] E.4 [test] 再次點擊同一 icon → context panel 收合
- [x] E.5 [test] context panel 有 Files / Git / Spec 三個 tab，點擊切換
- [x] E.6 [impl] 建立 `ContextPanel` 元件，讓 E.1–E.5 測試通過
- [x] E.7 [impl] `PaneHeader` 加入 `[📁][🌿][📋]` toolbar，展開/收合 context panel

---

## Phase 3：進階操作

> 前提：Phase 2 驗證完，確認 tool pane / context panel 使用模式後再做。

### Mobile 退化（M）

- [x] M.1 [test] 小螢幕（< 768px）時 `useMobileMode()` 回傳 `true`
- [x] M.2 [test] mobile 時 PaneHeader 隱藏 split buttons（⊟ / ⊞）
- [x] M.3 [test] mobile 時 `⌘\` / `⌘-` 鍵盤 split 快捷鍵為 no-op
- [x] M.4 [impl] 實作 `useMobileMode` hook + `PaneHeader` / `KeyboardShortcutsProvider` 整合

### Pane 對調（S）

- [x] S.1 [test] `swapPane(idA, idB)` action：交換兩 leaf 的 content
- [x] S.2 [test] `⌘⇧→` 將 focused pane content 與右方相鄰 pane 對調
- [x] S.3 [impl] 實作 `swapPane` action + `KeyboardShortcutsProvider` 加入 `⌘⇧方向鍵`

### Session Manager Overlay（O）

- [x] O.1 [test] `⌘⇧M` 開啟 Session Manager overlay（`data-testid="session-manager"`）
- [x] O.2 [test] Overlay 列出所有 sessions（name + status）
- [x] O.3 [test] Overlay 中點擊 session → 填入 focused pane 並關閉 overlay
- [x] O.4 [impl] 建立 `SessionManager` 元件 + keyboard shortcut

### Pane 拖拉重排（D）

- [x] D.1 [test] 拖曳 pane header 時顯示 `data-dragging` 屬性
- [x] D.2 [test] 放到另一 pane header 上 → 兩 pane content 對調
- [x] D.3 [impl] DnD：`draggable` header + `dragover` / `drop` handler 呼叫 `swapPane`

---

## Phase 4：New Session Picker 重構

> 前提：釐清 Project / Worktree 資料模型後進行。
> 核心原則：Worktree 所屬 project 透過 `listing` key 決定，不靠路徑前綴比對。

### Global Bar `[+]` Grouped Picker（G）

- [x] G.1 [test] `[+]` picker 以 project 分組，每組顯示 project 名稱 + 該 project 的 worktrees
- [x] G.2 [test] 無 active project 時 picker 仍顯示所有 project 及其 worktrees
- [x] G.3 [test] 選擇 worktree → `onNewSession(worktreePath, projectCwd)` 帶出 projectCwd（不靠 startsWith 反查）
- [x] G.4 [test] 選擇 worktree → active project 自動切換為該 worktree 所屬 project
- [x] G.5 [test] 每個 project 有自己的 `[+ New worktree]`，點擊開啟針對該 project 的 CreateWorktreeDialog
- [x] G.6 [test] Picker 底部有 `[+ Add project]` 入口
- [x] G.7 [impl] 更新 `GlobalBar` props：`allWorktrees: Record<projectCwd, WorktreeInfo[]>`，`onNewSession(cwd, projectCwd)`，`onCreateWorktree(projectCwd)`
- [x] G.8 [impl] 更新 `WorkspaceLayout` `onNewSession` handler：直接用傳入的 `projectCwd`，移除 `startsWith` 反查
- [x] G.9 [impl] 更新 `WorkspaceLayout` `onCreateWorktree` handler：接收 `projectCwd`，傳給 `CreateWorktreeDialog`

### Empty Pane Picker 對齊（P）

- [x] P.1 [test] 空白 pane picker「New session in」區塊以 project 分組，與 GlobalBar `[+]` 結構一致
- [x] P.2 [impl] 更新 `EmptyPanePicker` 的 new session 區塊，改為 grouped by project

---

## Phase 5：PanePicker統一 Modal

> 前提：Decision 7 更新後進行。
> 核心原則：所有「開新 session 或 tool pane」入口統一到同一個 Modal；EmptyPanePicker inline 簡化，不再有「New session in...」grouped list。

### PanePicker 元件（M）

- [x] M.1 [test] Modal 有四個 tab：Session / Git / Files / Spec
- [x] M.2 [test] Session tab 上半段列出現有 sessions（狀態 + 點擊填入 pane）
- [x] M.3 [test] Session tab 下半段列出「New session in」按 project 分組的 worktrees
- [x] M.4 [test] Session tab 每個 project 有 `[+ New worktree]` 和 `[+ Add project]`
- [x] M.5 [test] Tool tab（Git/Files/Spec）顯示 cwd 選擇器，預填 active project active worktree
- [x] M.6 [test] Tool tab cwd 可切換（dropdown 列出所有 project 的 worktrees）
- [x] M.7 [test] Tool tab 有 `[Open Git/Files/Spec pane]` 確認按鈕
- [x] M.8 [impl] 建立 `PanePicker.tsx`，讓 M.1–M.7 測試通過

### 入口接線（W）

- [x] W.1 [test] GlobalBar `[+]` 點擊 → 開啟 Modal（取代原 dropdown picker）
- [x] W.2 [test] SessionBar `[+]` 點擊 → 直接呼叫 `onNewSession`（不開 Modal，保留直接建立行為）
- [x] W.3 [test] EmptyPanePicker「+ Open new session...」按鈕 → 開啟 Modal（帶 target paneId）
- [x] W.4 [impl] 更新 `GlobalBar`：移除 dropdown picker，改用 `onOpenModal` callback
- [x] W.5 [impl] 更新 `WorkspaceLayout`：管理 Modal 開關狀態，傳遞給 GlobalBar / EmptyPanePicker（SessionBar 保留直接建立）
- [x] W.6 [impl] 更新 `EmptyPanePicker`：移除「New session in...」grouped list，加入「+ Open new session...」按鈕

### EmptyPanePicker 簡化（E）

- [x] E.1 [test] EmptyPanePicker 不再顯示「New session in...」grouped list
- [x] E.2 [test] EmptyPanePicker 顯示「+ Open new session...」按鈕
- [x] E.3 [test] Tool 按鈕（Git/Files/Spec/Worktrees）保留 inline，點擊直接填入 pane（不開 Modal）
- [x] E.4 [impl] 更新 `EmptyPanePicker`，讓 E.1–E.3 測試通過

---

## Phase 6：漏實作與 Bug 補齊

> 從 design 審查發現的未實作項目。

### Global Bar Sidebar Toggle（S）

- [x] S.1 [test] GlobalBar 有 `[☰]` 按鈕，點擊呼叫 `onToggleSidebar`
- [x] S.2 [test] `⌘⌥S` 快捷鍵觸發 sidebar toggle
- [x] S.3 [impl] 在 `GlobalBar` 加入 `[☰]` 按鈕與 `onToggleSidebar` prop
- [x] S.4 [impl] 在 `WorkspaceLayout` 接線 sidebar open/close 狀態，傳給 GlobalBar

### PanePicker 補齊（P）

- [x] P.1 [test] Modal Session tab 列出現有 sessions 時顯示 branch 資訊（`⎇ branch · title`）
- [x] P.2 [impl] `WorkspaceLayout` 將 active sessions 清單傳入 `PanePicker`（目前 `sessions` prop 為空）
- [x] P.3 [impl] `PanePicker` Session tab session 項目顯示 branch

### SessionBar `[+]` 接線補齊（SB）

- [x] SB.1 [impl] `TabContainer` 將 `onOpenModal` 傳給 `SessionBar`（design 決策 7：SessionBar `[+]` 開 Modal）
- [x] SB.2 [impl] 清除 `SessionBar` 的 `onNewSession` prop（已無使用者，改由 Modal 承接）

---

## Phase 7：Design vs Code 一致性修復

> 從 design spec / production code 比對後發現的不一致項目，用 TDD 方式修復。

### Context Panel Toolbar 顯示問題（E）

- [x] E.1 [test] `PaneHeader` 有 `cwd` 時顯示 `[📁][🌿][📋]` toolbar（`aria-label="Files/Git/Spec"` 按鈕可見）
- [x] E.2 [impl] `TabContainer` 的 `PaneLeafContent` 將 `cwd={meta?.cwd}` 傳給 `PaneHeader`（先前遺漏）

### EmptyPanePicker cwd 傳遞問題（T）

- [x] T.1 [test] `EmptyPanePicker` 的 `data-cwd` 使用 focused session cwd（focused pane 有 session 時）
- [x] T.2 [test] `EmptyPanePicker` 的 `data-cwd` fallback 到 `activeProjectCwd`（focused pane 無 session 時）
- [x] T.3 [impl] `TabContainer` 計算 `defaultCwd = focusedTabCwd ?? activeProjectCwd`，傳給 `EmptyPanePicker`

### Empty State "New Session" 統一走 Modal（DD7）

- [x] DD7.1 [test] 空白狀態 "New Session" 按鈕在 `onOpenModal` 存在時呼叫 `onOpenModal(undefined)`（不直接建立 session）
- [x] DD7.2 [test] `onOpenModal` 不存在時 fallback 直接建立（向後相容）
- [x] DD7.3 [impl] `TabContainer` empty state `onAction` 改為 `onOpenModal ? () => onOpenModal(undefined) : () => handleCreateTab()`

### ConnectedPanePicker 接線（W）

- [x] W.1 [test] `WorkspaceLayout` 的 Modal `onSelectSession` 將 session 填入 focused pane 並關閉 Modal
- [x] W.2 [test] `WorkspaceLayout` 的 Modal `onOpenToolPane` 建立 tool content pane 並關閉 Modal
- [x] W.3 [impl] 在 `TabProvider` 內建立 `ConnectedPanePicker`，透過 `usePaneActions`/`usePaneState` 接線

### SessionBar focused-active 狀態修復（SB）

- [x] SB.1 [test] session 在多個 pane 時，只有 focused pane 的 session 顯示 `focused-active`，其餘顯示 `active`
- [x] SB.2 [impl] 修復 `getSessionStatusInTree` DFS 邏輯：不提前 return `active`，繼續搜尋找 `focused-active`

### splitPane 後 focus 移到新 pane（SP）

- [x] SP.1 [test] `splitPane('h')` 後 `focusedPaneId` 移到新建立的 empty leaf
- [x] SP.2 [impl] 修改 `splitNode` 回傳 `{ root, newLeafId }`；`splitPane` action 更新 `focusedPaneId: newLeafId`

---

## Phase 8：Tool Pane Branch Display 修復

> Tool pane header 和 Modal tool tab 應顯示 `⎇ branch` 而非 raw `basename(cwd)`。
> 來源從 session tab cwds 改為 `GitContext.listing`（所有已知 worktree）。

### Tool Pane Header（T.4–T.5 更新）

- [x] T.4 [test] `ToolPaneHeader` button 顯示 `⎇ branch`（而非 `basename(cwd)`）；dropdown 顯示 `⎇ branch (project)` 格式；aria-label 改為 `worktree switcher`
- [x] T.5 [test] 點擊 worktree dropdown 選項後，pane content cwd 更新為對應 path（行為不變，只是 prop 型別從 `string[]` 改 `WorktreeOption[]`）
- [x] T.6 [impl] `ToolPanes.tsx` 新增 `WorktreeOption` 介面（`path / branch / name / projectName`）；`ToolPaneHeader` 以 `branchLabel()` 顯示 `⎇ branch`；dropdown 顯示 `⎇ branch (project)`

### Modal Tool Tab（M.5–M.6 更新）

- [x] M.5 [test] Git / Files / Spec tab selector label 改為 `Worktree:`（原為 `cwd:`）；aria-label 改為 `worktree`
- [x] M.6 [test] selector options 顯示 `⎇ branch (project)` 格式（原缺 `⎇` 前綴）
- [x] M.8 [impl] `PanePicker.tsx` ToolTab label 改為 `Worktree:`；option label 加 `⎇ ` 前綴

### TabContainer Wiring（TW）

- [x] TW.1 [impl] `TabContainer` 引入 `useGitState`；改傳 `availableWorktrees: WorktreeOption[]`（從 `listing` 建，含 `projectName`）給 `PaneLeafContent`，取代原本從 session tabs 收集的 raw cwds
- [x] TW.2 [impl] `PaneLeafContent` 介面新增 `availableWorktrees?: WorktreeOption[]`；傳給 `GitPane` / `FilesPane` / `SpecPane`

---

## Phase 9：Entry Point 重構

> 移除 Global Bar，Session Tab Bar `[+]` 改為 inline dropdown，EmptyPanePicker 補齊設計。
> 參考 design Decision 7。

### GlobalBar 移除（GB）

- [x] GB.1 [test] WorkspaceLayout 不再渲染 GlobalBar（`data-testid="global-bar"` 不存在）
- [x] GB.2 [test] Settings 按鈕移至 WorkspaceTabBar（`aria-label="Settings"` 在 `workspace-tab-bar` 內）
- [x] GB.3 [test] WorkspaceTabBar 有 `[+ Add project]` 按鈕
- [x] GB.4 [impl] 移除 `WorkspaceLayout.tsx` 的 `<GlobalBar>` render
- [x] GB.5 [impl] `WorkspaceTabBar` 新增 `onOpenSettings` / `onAddProject` props；渲染對應按鈕
- [x] GB.6 [impl] `TabContainer` 新增 `onOpenSettings` / `onAddProject` / `onNewWorktree` props，傳給 WorkspaceTabBar / SessionBar

### SessionBar `[+]` Inline Dropdown（SD）

- [x] SD.1 [test] 點擊 `[+]`（`aria-label="New session"`）顯示 `data-testid="new-session-dropdown"`
- [x] SD.2 [test] Dropdown 以 project 分組，顯示各 worktree `⎇ branch` 按鈕
- [x] SD.3 [test] Dropdown 每個 project 有 `[+ New worktree]` 按鈕
- [x] SD.4 [impl] `SessionBar.tsx` 新增 `availableWorktrees` / `projects` / `onNewSession` / `onNewWorktree` props；`[+]` 切換 inline dropdown
- [x] SD.5 [impl] `TabContainer` 傳 `availableWorktrees` / `projects` / `onNewSession` / `onNewWorktree` 給 SessionBar

### EmptyPanePicker 補齊（EP）

- [x] EP.1 [test] `"+ Open new session..."` → `"More options..."` 按鈕
- [x] EP.2 [test] EmptyPanePicker 有 `── New session in ──` 區塊，列出各 project 的 worktree `[+ branch]` 按鈕（design 要求，未實作）
- [x] EP.3 [test] 點擊 `[+ branch]` → 在該 pane 建立 session（不需開 modal）
- [x] EP.4 [impl] `EmptyPanePicker` 新增 `availableWorktrees` / `projects` props；渲染 `[+ branch]` 按鈕
- [x] EP.5 [impl] `TabContainer` 傳 `availableWorktrees` / `projects` 給 `EmptyPanePicker`

---

## Phase 10：Context Panel（session 附著型 tool panel）

> session 是核心。Git / Files / Spec 是 session 的 context view，cwd 自動跟 session，不需手動指定。
> Context Panel 是 99% 使用情境的主要入口。
> 參考 design Section E。

### Session Pane Header Toolbar（CT）

> **架構更正（Phase 15）**：Context Panel 改為與 main branch `RightPane` 一致的 inline side panel。
> `activeTool` state 從 `PaneHeader` 提升到 `PaneLeafContent`，透過 `ChatView.rightPane` 渲染，
> `PaneHeader` 只 fire `onToolSelect` callback。詳見 Phase 15。

- [x] CT.1 [test] session pane header 有 `[📁][🌿][📋]` toolbar 按鈕（`aria-label="Toggle Files panel"` 等）
- [x] CT.2 [test] 點擊 `[🌿]` → `data-testid="context-panel"` 出現在 session pane 右側
- [x] CT.3 [test] Context Panel 預設顯示 Git tab；header 有 `[📁 Files][🌿 Git][📋 Spec]` tab 切換
- [x] CT.4 [test] 再次點擊同一個 toolbar 按鈕 → context panel 收合
- [x] CT.5 [test] context panel 的 cwd 自動等於該 session 的 `cwd`（不需使用者手動指定）
- [x] CT.6 [impl] `PaneHeader` 新增 toolbar 按鈕；渲染三個 toolbar 按鈕
- [x] CT.7 [impl] `PaneHeader` 管理 context panel state；render `<ContextPanelGit/Files/Spec cwd={cwd} />`

### Context Panel — Git Tab（CG）

- [x] CG.1 [test] Git tab mount 時呼叫 `GitContext.status(cwd)`
- [x] CG.2 [test] 顯示 branch 名稱 + clean/dirty 狀態
- [x] CG.3 [test] 顯示 changed files 清單（status code `M`/`A`/`D`/`??` + 檔名）
- [x] CG.4 [test] 顯示 ahead/behind upstream（有 upstream 時）
- [x] CG.5 [test] 點擊 file → inline 顯示 diff（使用 EVENTS.git.diff）
- [x] CG.6 [test] `[↺]` 按鈕重新呼叫 status
- [x] CG.7 [impl] 實作 `ContextPanelGit`（`ContextPanel.tsx`）
- [x] CG.8 [impl] `GitContext` 補齊 `diff(cwd, filePath?)` action（目前直接用 rpc，可優化）

### Context Panel — Files Tab（CF）

- [x] CF.1 [test] Files tab mount 時呼叫 `FsContext.browse(cwd)`
- [x] CF.2 [test] 顯示目錄 + 檔案清單（directories 優先）
- [x] CF.3 [test] 點擊目錄 → 導覽進入，顯示麵包屑
- [x] CF.4 [test] 麵包屑可點擊回上層
- [x] CF.5 [impl] 實作 `ContextPanelFiles`（`ContextPanel.tsx`）

### Context Panel — Spec Tab（CS）

- [x] CS.1 [test] Spec tab mount 時呼叫 `OpenspecContext.getOpenspecList(cwd)`
- [x] CS.2 [test] 顯示 changes 清單（name + task progress `done/total`）
- [x] CS.3 [test] 顯示 specs 清單（capability 名稱）
- [x] CS.4 [test] 點擊 change → 顯示 tasks.md 內容（需要 openspec:read RPC，未接）
- [x] CS.5 [impl] 實作 `ContextPanelSpec`（`ContextPanel.tsx`）

---

## Phase 15：Context Panel 重構為 Inline Side Panel

> **動機**：Phase 10 實作的 Context Panel 將 panel 渲染於 header 正下方（inline-under-header），
> 與 main branch `RightPane`（inline side panel，`flex-row`）不一致，
> 且多 pane 情境下空間利用差，`ContextPanel.tsx` 元件也重複實作了 `FilesPane/GitPane/SpecPane` 的功能。
>
> **目標**：`activeTool` state 提升到 `PaneLeafContent`，透過 `ChatView.rightPane` inline 渲染，
> `PaneHeader` 只負責 icon + callback，不持有 state 也不渲染 panel。

### CT2（Context Panel 重構）

- [x] CT2.1 [test] `PaneHeader` 改為接收 `activeTool` prop + `onToolSelect` callback，不再自己持有 state
- [x] CT2.2 [test] `PaneLeafContent` 持有 `activeTool` state；點 `[🌿]` → activeTool='git'
- [x] CT2.3 [test] `PaneLeafContent` 再次點擊同一 icon → activeTool=null（toggle 收合）
- [x] CT2.4 [test] `ChatView` 收到非 null `rightPane` prop → 渲染於 chat body 右側（`flex-row`，`w-72 shrink-0 border-l`）
- [x] CT2.5 [test] `RightPane` 接收 `initialTab` prop → 預設顯示對應 tab（'files'|'git'|'spec'）
- [x] CT2.6 [impl] `PaneHeader`：移除 `activeTool` useState，改為 `activeTool` prop + `onToolSelect(tool)` callback
- [x] CT2.7 [impl] `PaneLeafContent`：加入 `activeTool` state，切換時傳給 `PaneHeader` 及 `ChatView.rightPane`
- [x] CT2.8 [impl] 從 main branch 移植 `RightPane`（`apps/web/src/components/workspace/RightPane.tsx`），加入 `initialTab` prop
- [x] CT2.9 [impl] `ChatView.rightPane` 以 `w-72 shrink-0 border-l border-border overflow-y-auto` 渲染（不用 overlay）
- [x] CT2.10 [impl] 移除 `ContextPanel.tsx` 中已被 `RightPane` 取代的渲染邏輯（`ContextPanelFiles/Git/Spec` 的對應部分）

---

## Phase 11：Independent Tool Pane（split tree 獨立型）

> 進階使用情境：需要並排查看不同 worktree 的 git diff，或在固定位置長時間參考 tool pane。
> cwd 預設為 focused session 的 cwd，可在 pane header 手動切換 worktree。
> 參考 design Decision 8 + EmptyPanePicker tool 按鈕。

### GitPane — 接 server（GP）

- [x] GP.1 [test] GitPane mount 時呼叫 `GitContext.status(cwd)`（複用 ContextPanelGit）
- [x] GP.2 [test] 顯示 changed files + branch + ahead/behind
- [x] GP.3 [test] Pane header `⎇ branch ▾` 下拉可切換 worktree（更新 cwd）
- [x] GP.4 [impl] `GitPane` 內嵌 `ContextPanelGit`

### FilesPane — 接 server（FP）

- [x] FP.1 [test] FilesPane mount 時呼叫 `FsContext.browse(cwd)`（複用 ContextPanelFiles）
- [x] FP.2 [test] 顯示目錄 + 檔案清單 + 麵包屑
- [x] FP.3 [test] Pane header `⎇ branch ▾` 下拉可切換 worktree
- [x] FP.4 [impl] `FilesPane` 內嵌 `ContextPanelFiles`

### SpecPane — 接 server（SP）

- [x] SP.1 [test] SpecPane mount 時呼叫 `OpenspecContext.getOpenspecList(cwd)`（複用 ContextPanelSpec）
- [x] SP.2 [test] 顯示 changes + specs
- [x] SP.3 [test] Pane header `⎇ branch ▾` 下拉可切換 worktree
- [x] SP.4 [impl] `SpecPane` 內嵌 `ContextPanelSpec`

### WorktreesPane — 接 server（WP）

- [x] WP.1 [test] WorktreesPane 顯示所有 project 的 worktrees（branch + path）
- [x] WP.2 [test] 每個 worktree 有 `[+]` 按鈕 → 在 focused pane 建立 session
- [x] WP.3 [test] 有 session 的 worktree 顯示 session 標題
- [x] WP.4 [test] `[+ New worktree]` 按鈕呼叫 `onNewWorktree`
- [x] WP.5 [impl] 實作 `WorktreesPane` 接 `GitContext` + `ProjectContext`

---

## Phase 12：Workspace Overview

> 取代 SessionManager + Project List，統一管理 sessions + projects + worktrees。
> 參考 design Section F。

- [x] WO.1 [test] `⌘⇧M` / Tab Bar `[⊞]` 開啟 Workspace Overview overlay
- [x] WO.2 [test] Overlay 以 Layout Tab 分組顯示 sessions
- [x] WO.3 [test] 點擊 session card → 填入 focused pane 並關閉 overlay
- [x] WO.4 [test] Projects 區塊：每個 project 列出 worktrees；有 session 者顯示 session title；無 session 者顯示 `[+ New session]`
- [x] WO.5 [test] Projects 區塊：`[+ New worktree]` / `[+ Add project]` 入口
- [x] WO.6 [impl] 擴充 `SessionManager.tsx` 成 Workspace Overview，讓 WO.1–WO.5 通過

---

## Phase 13：PanePicker 重設計（兩欄 + Resume）

> 採用設計方案 C：全版兩欄 modal。左欄 worktree 樹，右欄依選定 worktree 顯示
> Active / Resume / New session / Tools 四區。Resume 使用 session:list excludeLive + session:resume。

### Props 擴充（PP）

- [x] PP.1 [test] PanePicker 接受 `pastSessions` prop（SessionSummary[]），Resume 區渲染每筆項目
- [x] PP.2 [test] PanePicker 接受 `onResume` prop，點擊 [Resume] 呼叫 `onResume(sessionId)`
- [x] PP.3 [test] PanePicker 接受 `onShowHere` prop，點擊 [Show here] 呼叫 `onShowHere(channelId, paneId)`（取代舊 onSelectSession）
- [x] PP.4 [impl] 更新 `PanePickerProps`，新增 `pastSessions`、`onResume`、`onShowHere`

### 左欄 worktree 樹（LT）

- [x] LT.1 [test] 左欄列出所有 projects，每個 project 展開顯示其 worktrees
- [x] LT.2 [test] 有 active session 的 worktree 顯示 `●` 指示
- [x] LT.3 [test] 點選左欄 worktree → 右欄切換到對應 worktree 內容
- [x] LT.4 [test] 預設選中 active project 的第一個 worktree
- [x] LT.5 [impl] 實作左欄 `WorktreeTree` 子元件

### 右欄內容四區（RC）

- [x] RC.1 [test] Active 區：列出 workspace 中 cwd 屬於此 worktree 的 sessions，每筆有 `[Show here]` 按鈕
- [x] RC.2 [test] Resume 區：列出 pastSessions 中 cwd 屬於此 worktree 的項目，顯示 title + 相對時間，每筆有 `[Resume]` 按鈕
- [x] RC.3 [test] New session 區：`[+ New session]` 按鈕，呼叫 onNewSession(worktree.path, project.cwd)
- [x] RC.4 [test] Tools 區：`[Git]` `[Files]` `[Spec]` 按鈕，呼叫 onOpenToolPane(type, worktree.path)
- [x] RC.5 [impl] 實作右欄 `WorktreeContent` 子元件，整合四區

### WorkspaceLayout 接線（WL）

- [x] WL.1 [test] PanePicker 開啟時呼叫 `session:list { excludeLive: true, cwd }` 取得 pastSessions
- [x] WL.2 [test] `onResume` → 呼叫 `SessionContext.resume(sessionId)` → 取得 channelId → setSessionInPane
- [x] WL.3 [impl] `ConnectedPanePicker` 新增 pastSessions fetch 與 onResume 接線

---

## Phase 14：PanePicker view 切換 + AI picker

> 設計方案 B（單欄平面列表）已實作基本結構。本階段新增 view 切換（mini-router）、
> AI picker（Claude / Codex 層級）、Resume view、Import view。
>
> 規則：
> - One-click：Git、Files、Spec → 直接開 pane（維持現況）
> - View-switch（`▶`）：AI、Resume、Import → PanePicker 整體切換 view，`[←]` 返回
> - Resume / Import 與 AI 種類綁定（Claude resume ≠ Codex resume）
> - Esc 永遠關整個 PanePicker（不只關 sub-view）

### View 切換基礎（VS）

- [x] VS.1 [test] PanePicker 有 `view` state，預設為 `{ type: 'main' }`
- [x] VS.2 [test] 非 main view 時顯示 `[←]` 返回按鈕，點擊回到 main view
- [x] VS.3 [test] `[←]` 返回時 view 回到上一層（支援多層 history）
- [x] VS.4 [impl] 實作 view stack（push / pop），reset on open

### AI Picker view（AI）

- [x] AI.1 [test] 每個 worktree 有 `[💬 AI ▶]` 按鈕
- [x] AI.2 [test] 點擊 `[💬 AI ▶]` 切換到 AI picker view，顯示 `[←] AI — ⎇ <branch>`
- [x] AI.3 [test] AI picker view 列出 `[Claude]`，點擊立刻呼叫 `onNewSession`（2 clicks）
- [x] AI.4 [test] AI picker view 有 `[⟳ Resume ▶]`（有 pastSessions 時）和 `[⬆ Import ▶]`
- [x] AI.5 [test] 主 view 不出現 Resume / Import 按鈕
- [x] AI.6 [impl] 實作 AI picker view（Claude 立刻 + Resume ▶ + Import ▶ + 未來 Codex ▶）

### Resume view（RV）

- [x] RV.1 [test] past sessions 在主 view 隱藏
- [x] RV.2 [test] 點擊 AI picker 內的 `[⟳ Resume ▶]` 切換到 Resume view，顯示 `[←] Resume — ⎇ <branch>`
- [x] RV.3 [test] Resume view 列出該 worktree 的 past sessions，每筆有 title + 相對時間 + `[Resume]` 按鈕
- [x] RV.4 [test] 點擊 `[Resume]` 呼叫 `onResume(sessionId)`
- [x] RV.5 [test] `[←]` 從 Resume view 返回 AI picker
- [x] RV.6 [impl] 實作 Resume view，從 AI picker 進入

### Import view（IV）

- [x] IV.1 [test] 點擊 AI picker 內的 `[⬆ Import ▶]` 切換到 Import view，顯示 `[←] Import — ⎇ <branch>`
- [x] IV.2 [test] Import view 列出 `[📄 Claude JSONL]` 選項
- [x] IV.3 [test] 點擊 `[📄 Claude JSONL]` 呼叫 `onImport('claude-jsonl', worktreePath)`
- [x] IV.4 [test] `[←]` 從 Import view 返回 AI picker
- [x] IV.5 [impl] 實作 Import view（架構支援未來加其他格式）

---

## Phase 16：RightPane 換用 main branch 完整 Pane 實作

> **動機**：Phase 10/15 的 `ContextPanel.tsx`（`ContextPanelGit/Files/Spec`）是自行輕量重寫，
> 功能不完整（無 git commit、無 file preview、無 spec CRUD）。
> main branch 的 `FilesPane`/`GitPane`/`SpecPane` 已有完整功能，且同一 branch 已存在。
> 直接換用，廢棄 `ContextPanel.tsx` 中的輕量版實作。
>
> **目標**：`RightPane` 的三個 tab 改用 `FilesPane`/`GitPane`/`SpecPane`；
> `FilesPane.onMention` 透過 `useChannelComposeActions` 插入 compose 欄；
> `ContextPanel.tsx` 棄用，相關測試遷移。

### 換用完整 Pane 元件（RP）

- [ ] RP.1 [test] `RightPane` Files tab 渲染 `FilesPane`（`aria-label="files-pane"` 可見）
- [ ] RP.2 [test] `RightPane` Git tab 渲染 `GitPane`（`aria-label="git-pane"` 可見）
- [ ] RP.3 [test] `RightPane` Spec tab 渲染 `SpecPane`（`aria-label="spec-pane"` 可見）
- [ ] RP.4 [test] `FilesPane.onMention` 呼叫 `useChannelComposeActions().appendMention(path)`，插入 compose 欄
- [ ] RP.5 [impl] `RightPane.tsx`：將 `ContextPanelFiles/Git/Spec` 換成 `FilesPane/GitPane/SpecPane`
- [ ] RP.6 [impl] `RightPane.tsx`：傳入 `onMention={(path) => appendMention(path)}` 給 `FilesPane`
- [ ] RP.7 [impl] 確認 `FilesPane`/`GitPane`/`SpecPane` 所需 context（`FsProvider`、`GitProvider`、`OpenspecProvider`）已在 `ChannelProvider` 或更上層 provide

### 棄用 ContextPanel.tsx（DP）

- [ ] DP.1 [impl] 將 `ContextPanel.tsx` 中的 `ContextPanelGit/Files/Spec` 標記為 deprecated（或直接刪除）
- [ ] DP.2 [impl] 確認 `ContextPanel.tsx` 沒有其他 consumer，若有則一併遷移
- [ ] DP.3 [impl] 更新 `ContextPanel.test.tsx`：移除對 `ContextPanelGit/Files/Spec` 的直接測試，改測 `RightPane` 整合行為
- [ ] DP.4 [impl] 確認所有測試綠燈（`pnpm test`）
