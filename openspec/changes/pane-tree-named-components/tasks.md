# Pane Tree Named Components — Tasks

依賴順序：A（shape）→ B（codecs）→ C（named components）→ D（bug 修正）→ E（rename/收尾）。
Wire schema v2 的對應任務在 `layout-persistence` tasks.md §13（依賴本 change 的 A/B）；
rehydrate／live-channel 重綁（mode:'resume' 不 spawn）的測試在 layout-persistence §11（11.4/11.9/11.10）。

## A. PaneContent shape 變更

- [x] 1.1 [test] `setSessionInPane(paneId, sessionId, cwd)` — 綁定後 leaf content 為 `{ type:'session', sessionId, cwd }`
- [x] 1.2 [test] `splitPaneAndAssign(direction, sessionId, cwd)` — 新 leaf content 帶 cwd
- [x] 1.3 [impl] `PaneContent` session variant 加 `cwd: string | null`；兩個 action 簽名加 cwd；呼叫端（TabContainer/PanePicker/KeyboardShortcutsProvider）補傳
- [x] 1.4 [test] tool pane content `target: { kind:'fixed', cwd }` — WorktreeSwitcher 切換後 target.cwd 更新
- [x] 1.5 [impl] git/files/openspec content 改 `target` shape；`makeContent` 呼叫端同步
- [x] 1.6 [impl] client `'spec'` rename `'openspec'`（機械性，含 testid 不變確認）

## B. pane-codecs

- [x] 2.1 [test] `serializeContent` / `deserializeContent` — 每個 type 的 roundtrip property test：`serialize(deserialize(x)) === x`（identity 契約）
- [x] 2.2 [test] deserialize 為 permissive — 不驗 cwd 存在性、不查 live sessions（餵已刪 worktree 的 cwd 仍原樣轉換）
- [x] 2.3 [impl] 新增 `contexts/pane-codecs.ts`：mapped type `Serializers`/`Deserializers` + generic indexed access dispatch，零 React import、零 cast
- [x] 2.4 [impl] `AssertEqual<PaneContent['type'], PersistedPaneContent['type']>` 靜態斷言
- [x] 2.5 [refactor] TabContext 的 serializePaneNode/deserializePaneNode 改走 codecs，刪除 `as` cast
- [x] 2.6 [test] ratio 精度 — serialize split node 時 ratio round 到 4 位小數（`0.6342819…` → `0.6343`），roundtrip 後穩定（echo guard 字串比對前提）
- [x] 2.7 [test] ratio clamp — deserialize 時 ratio 限制在 `[0.05, 0.95]`，壞資料（0、1、NaN、負數）clamp 後仍渲染出可見的 pane
- [x] 2.8 [impl] serializeNode round ratio；deserializeNode clamp ratio。schema 層用 catch/clamp（如 `z.number().catch(0.5)`）**不可 reject**——壞 ratio 不得讓 safeParse 打掉整份 layout

## C. Named pane components

- [x] 3.1 [impl] `SplitPane` → `PaneTree`、split 分支 → `PaneSplit`、`SplitPaneLeaf` → `PaneLeaf`（rename + 拆檔，行為不變，既有測試過）
- [x] 3.2 [test] PaneLeaf — 渲染 `<Pane>` + `<Pane.Toolbar>`（common props 含 onSwap）+ type 對應的 Body
- [x] 3.3 [impl] 新增 `components/workspace/panes/`：`SessionPane` / `GitPane` / `FilesPane` / `OpenspecPane` / `WorktreesPane`（PaneView 介面：ToolbarTools? / Body / scrollable?；worktrees case 先沿用現有渲染、3.6 收斂 toolbar）；PaneLeaf exhaustive switch + `satisfies never`
- [x] 3.4 [test] SessionPane — meta 存在渲染 TabContent；meta 缺席渲染 EmptyPane + cwd hint（「上次: {project} ⎇ {branch}」；worktree-centric D3 落地前先用 availableWorktrees 本地反查）
- [x] 3.5 [test] SessionPane self-heal — sessions 晚到（meta 後出現）同一 leaf 自動從 EmptyPane 切回 TabContent；emit session:closed 後自動降級回 EmptyPane
- [x] 3.6 [impl] WorktreesPane 接入 PaneLeaf 統一 toolbar（移除裸 div 包裝）
- [x] 3.7 [test] SessionPool — pane 未指派的 live session 在 pool 中保持 mount（既有 anti-double-mount 測試遷移）
- [x] 3.8 [refactor] 刪除 PaneLeafContent if/else；TabContainer 瘦身（renderLeaf closure 移除）

## D. Bug 修正

- [ ] 4.1 [test] zoom — zoom 後 zoomed pane 佔滿 split-pane-root（style 斷言：無 percentage wrapper、無 divider）
- [ ] 4.2 [test] mobile — focused pane 佔滿、其餘 split 不渲染
- [ ] 4.3 [impl] PaneSplit 用 `hasLeaf` 判斷 zoom/mobile 目標側，只渲染該側；PaneLeaf 移除 hidden 邏輯
- [ ] 4.4 [test] DnD swap — dragstart pane A header → drop pane B header → 兩 leaf content 互換
- [x] 4.5 [impl] PaneLeaf common props 接 `onSwap: (sourceId) => swapPane(sourceId, node.id)`
- [ ] 4.6 [test] 純 tool-pane layout（無 session tab）— PaneTree 照常渲染 git/worktrees pane，不被空狀態 gate 吃掉
- [ ] 4.7 [impl] TabContainer early return 改判「預設空狀態」（單 tab 且單一 empty session leaf）
- [ ] 4.8 [impl] PaneLeaf 外層 `key={node.id}`

## E. 收尾

- [ ] 5.1 [refactor] 全套測試過、knip/biome 乾淨
- [ ] 5.2 [refactor] 更新既有 specs 的 delta，具體過時項：`split-pane/spec.md` 的「SplitPane leaf renders Pane compound」requirement（更名 PaneTree/PaneSplit/PaneLeaf、toolbar 改 PaneLeaf 統一渲染、session 不包 Pane.Content）、「Spec pane」scenario 的 `type:'spec'`→`'openspec'`；`pane-compound-component/spec.md` 的 WorktreeSwitcher scenario（`setContentInPane` 改 target shape）；zoom 行為歸新 pane-tree spec
