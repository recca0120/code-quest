## Why

Client 端 `PaneContent.sessionId` 欄位語意上承載的是 `channelId`（live socket channel ID），但命名為 `sessionId`。Wire schema（`packages/schemas/src/socket/layout.ts`）正確用 `channelId`。`pane-codecs.ts` 在 serialize/deserialize 時做無意義的 rename mapping（`sessionId ↔ channelId`）。

這造成：
- 新人讀 code 混淆 `sessionId`（DB session record）和 `channelId`（live channel）
- `findPaneBySession(node, channelId)` 函數參數已叫 `channelId` 但比對 `content.sessionId`
- pane-codecs 的 rename mapping 是純噪音，增加維護成本

## What Changes

將 client 端所有 `PaneContent.sessionId` 統一改為 `channelId`，使 client 模型與 wire schema 命名一致。

### 改動範圍

**Core（型別 + 演算法）：**
- `pane-tree.ts` — `PaneContent` 型別 `sessionId → channelId`，所有讀取點
- `pane-codecs.ts` — 消除 rename mapping，兩側名稱一致直接 spread
- `WorkspaceLayoutContext.tsx` — action 參數名

**元件（12 個）：**
- SessionPane, SessionPool, ZoomBar, PaneTree, TabContainer, MobilePaneWall, KeyboardShortcutsProvider, useCreateSessionInPane, pane-registry, Pane（含 MobileDockBar、CondensedPaneStrip 若有引用）

### 保留不改
- `Workspace.tsx` 的 `onResume(sessionId)` — 真正的 DB session ID
- `PanePicker.tsx` 的 `onResume?: (sessionId: string)` — 同上
- `SessionContext` 裡的 `sessionId` — 那是 DB 層的 session record ID

## Out of Scope
- LayoutStore 落盤（sub-change 2）
- Wire schema 本身不動（已正確用 channelId）
