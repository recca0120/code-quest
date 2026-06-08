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
- [ ] 6.4 [test] tab 顯示 busy indicator 當該 tab 內有 running session（Phase 2）
- [ ] 6.5 [test] tab 標題雙擊進入 inline rename（Phase 2）
- [x] 6.6 [impl] 切換 tab 時 paneRoot 各自獨立（per-tab pane tree 在 wsState 中）
- [x] 6.7 [impl] 建立 `WorkspaceTabBar` 元件，讓 6.1–6.3 測試通過

### 7. Session Tab Bar（C）

- [x] 7.1 [test] 點擊 inactive session tab → 填入 `focusedPane`
- [ ] 7.2 [test] 點擊 active session tab（已在某 pane）→ focus 移到該 pane（Phase 2）
- [x] 7.3 [test] session tab 三種狀態樣式：focused-active / active / inactive
- [ ] 7.4 [test] Session Bar `[+]` 在 focused pane 的 cwd 開新 session（Phase 2）
- [x] 7.5 [impl] 建立 `SessionBar` 元件，讓 7.1, 7.3 測試通過
- [x] 7.6 [test] session tab 顯示 `●/○` status dot（busy 時 ●，其他 ○）
- [x] 7.7 [test] session tab 顯示 `⎇ branch`（有 branch 時）
- [x] 7.8 [test] session tab 有 `×` close 按鈕，點擊後 session 關閉（closeSession + removeTab）
- [x] 7.9 [impl] SessionBar 補完：status dot + branch + close，讓 7.6–7.8 測試通過

### 8. 空白 Pane Picker

- [x] 8.1 [test] 空白 pane 顯示 picker，列出所有 inactive session
- [ ] 8.2 [test] picker 列出「New session in」各 worktree 快速入口（Phase 2）
- [x] 8.3 [test] 選 session → `setSessionInPane`；pane 顯示該 session
- [ ] 8.4 [test] 選 new session → 開新 session 並填入此 pane（Phase 2）
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

## Phase 5：「Open in Pane」統一 Modal

> 前提：Decision 7 更新後進行。
> 核心原則：所有「開新 session 或 tool pane」入口統一到同一個 Modal；EmptyPanePicker inline 簡化，不再有「New session in...」grouped list。

### OpenInPaneModal 元件（M）

- [ ] M.1 [test] Modal 有四個 tab：Session / Git / Files / Spec
- [ ] M.2 [test] Session tab 上半段列出現有 sessions（狀態 + 點擊填入 pane）
- [ ] M.3 [test] Session tab 下半段列出「New session in」按 project 分組的 worktrees
- [ ] M.4 [test] Session tab 每個 project 有 `[+ New worktree]` 和 `[+ Add project]`
- [ ] M.5 [test] Tool tab（Git/Files/Spec）顯示 cwd 選擇器，預填 active project active worktree
- [ ] M.6 [test] Tool tab cwd 可切換（dropdown 列出所有 project 的 worktrees）
- [ ] M.7 [test] Tool tab 有 `[Open Git/Files/Spec pane]` 確認按鈕
- [ ] M.8 [impl] 建立 `OpenInPaneModal.tsx`，讓 M.1–M.7 測試通過

### 入口接線（W）

- [ ] W.1 [test] GlobalBar `[+]` 點擊 → 開啟 Modal（取代原 dropdown picker）
- [ ] W.2 [test] SessionBar `[+]` 點擊 → 開啟 Modal
- [ ] W.3 [test] EmptyPanePicker「+ Open new session...」按鈕 → 開啟 Modal（帶 target paneId）
- [ ] W.4 [impl] 更新 `GlobalBar`：移除 dropdown picker，改用 `onOpenModal` callback
- [ ] W.5 [impl] 更新 `WorkspaceLayout`：管理 Modal 開關狀態，傳遞給 GlobalBar / SessionBar / EmptyPanePicker
- [ ] W.6 [impl] 更新 `EmptyPanePicker`：移除「New session in...」grouped list，加入「+ Open new session...」按鈕

### EmptyPanePicker 簡化（E）

- [ ] E.1 [test] EmptyPanePicker 不再顯示「New session in...」grouped list
- [ ] E.2 [test] EmptyPanePicker 顯示「+ Open new session...」按鈕
- [ ] E.3 [test] Tool 按鈕（Git/Files/Spec/Worktrees）保留 inline，點擊直接填入 pane（不開 Modal）
- [ ] E.4 [impl] 更新 `EmptyPanePicker`，讓 E.1–E.3 測試通過
