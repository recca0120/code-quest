# Pane Tree Named Components

## Why

Pane 是樹狀結構，但目前的渲染與序列化都沒有按樹的節點類型命名與分工：

1. **`PaneLeafContent` 是巨型 if/else dispatch**（`TabContainer.tsx:104-235`）：每加一種 pane type 要改這個 200 行函式；git/files/spec 三份近乎相同的 `Pane` + `WorktreeSwitcher` 包裝重複。
2. **序列化用 `as` cast 矇混**（`TabContext.tsx:248`）：非窮舉轉換讓 `worktrees` pane 整份 layout 靜默失效（layout-persistence F2 的根因）。
3. **三個現存 bug**（2026-06-10 三視角批判審查發現）：
   - **Zoom 沒有放大效果**：`SplitPaneLeaf` 用 `hidden` 隱藏其他 pane，但 split wrapper 的 `width: ratio*100%` 仍在——zoom 的 pane 被困在自己原本的格子，其餘是空白佔位（jsdom 測試只驗 `hidden` 屬性抓不到）
   - **Toolbar DnD swap 是死碼**：`Pane.Toolbar` 有完整 drag/drop handler，但 `TabContainer` 從未傳 `onSwap`
   - **空 session gate 吃掉 tool-pane layout**：`TabContainer.tsx:400` 在 session tabs 為空時 early return，純 tool pane（git/worktrees）的還原 layout 整份看不到——server 重啟後 session 死光時是常態路徑

## What Changes

### 元件樹命名（named components）

- `SplitPane` → `PaneTree`（遞迴渲染器）、`SplitPaneNode` split 分支 → `PaneSplit`、`SplitPaneLeaf` → `PaneLeaf`
- `PaneLeafContent` 的 if/else 改為 **exhaustive switch** dispatch 到 named pane components：`SessionPane` / `GitPane` / `FilesPane` / `OpenspecPane` / `WorktreesPane`（`default: content satisfies never` 編譯期窮舉）
- **EmptyPane 不是 pane type**：是 `SessionPane` 在 `meta` 缺席時的 render 分支
- 兩個 hidden 區塊抽名為 `SessionPool`；`TabContent`（ChannelProvider wrapper）維持獨立掛載單位，**不可內聯**進 SessionPane（pool 共用，防 "Channel already exists" 雙 mount）

### Registry 拆兩個（避免 contexts ↔ components 循環）

- `pane-codecs.ts`：純 TS、零 React import 的 serialize/deserialize mapped type，TabContext 只吃這個；dispatch 用 TS generic indexed access（零 cast）
- View 層用 exhaustive switch（不用 Record lookup——union component 的 JSX props 會塌縮成 never）

### Toolbar 所有權反轉

- `PaneLeaf` 統一渲染 `<Pane>` + `<Pane.Toolbar {...common}>`，pane type 只提供 `ToolbarTools` slot 與 `Body`——toolbar 存在性與 props 正確性一處保證；順手接上 `onSwap`（修死碼）

### Client content shape 變更

- session content 改 `{ type:'session'; sessionId: string|null; cwd: string|null }`，`setSessionInPane` / `splitPaneAndAssign` 簽名加 cwd，綁定當下寫入——serialize 變純函式（殺 stale closure），cwd 同時是 EmptyPane 還原 hint
- tool pane content 改 `target: { kind:'fixed', cwd } | { kind:'follow' }`（預留 worktree-centric D5，目前只實作 fixed）
- client `'spec'` rename 為 `'openspec'`，對齊 wire 與 server events
- split ratio：serialize round 到 4 位小數、還原時 clamp `[0.05, 0.95]`（echo guard 穩定性＋defensive restore，schema 層用 catch/clamp 不 reject）

### Bug 修正

- Zoom/mobile 可見性與尺寸決策上移到 `PaneSplit`（用 `hasLeaf` 判斷目標在哪一側，只渲染該側）
- 空 session gate 改判「layout 是否為預設空狀態」
- `PaneLeaf` 加 `key={node.id}`（leaf id 由 wire 帶來，跨裝置 mount 穩定）

## Impact

- **影響檔案**：`SplitPane.tsx`（改名拆分）、`TabContainer.tsx`（大幅瘦身）、`TabContext.tsx`（content shape、codecs 抽出）、`Pane.tsx`（不變）、新增 `panes/` 目錄與 `pane-codecs.ts`
- **相依**：`layout-persistence` 的 wire v2（schema 同步改 shape）依賴本 change 的 content shape——**本 change 先做**；`worktree-centric-workspace` D5 的 follow mode 已在 shape 預留（shape 以本 change D1 為準）。EmptyPane hint 的 cwd→{project, branch} 反查在 worktree-centric D3 lookup map 落地前，先用 TabContainer 既有 `availableWorktrees` 本地反查，D3 落地後改吃共用 map
- **RightPane**：維持 ephemeral quick-view 不入樹（design D8），worktree-centric D5 落地後再評估退役
- **測試**：zoom 修正需補 layout 級驗證（jsdom 驗不到，用 Storybook/Playwright 或斷言 style）；既有 pane 測試的 testid 不變
