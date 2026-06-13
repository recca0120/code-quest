## Why

Workspace 的 HTML/component 結構隨功能疊加逐漸偏離「每個概念一個層級」的原則，造成以下痛點：

1. **RightPane (rail) 被包在 ChatView 裡**：rail 的 files/git/spec 在概念上是獨立 tool pane，但 DOM 上被包在 ChannelProvider（AI 對話 context）裡面，導致 rail 的生命週期、cwd 來源都綁在 session 上
2. **DrawerHost 與 RightPane 各自 mount 相同的 View 元件**：兩條路徑產出相同 DOM，但 cwd 傳遞和 header 結構不同
3. **PaneLeafBody 有兩套 header 路徑**：session pane 走 ChatView 自己的結構，tool pane 走 Pane.Toolbar，組成元素相似但程式碼分歧
4. **Workspace.tsx 身兼數職**：同時管理 5 個 dialog state + worktree listing + project list + 各種 callback
5. **Provider 巢狀 13+ 層**：雖不影響效能，但認知負擔重，新人難以理解資料流

這些都是純結構問題，不涉及行為變更。重構後使用者看到的畫面完全不變。

## What Changes

將 workspace 的 component 結構重組為更扁平、更模組化的形式：

- **Provider 扁平化**：減少不必要的巢狀層級
- **Dialog state 從 Workspace 抽出**：每個 dialog 自管 open state
- **PaneLeafBody 統一 header/toolbar 路徑**：session pane 和 tool pane 共用同一套 Pane.Toolbar
- **DrawerHost 與 RightPane 共用 view rendering**：抽出共用的 body render 邏輯
- **Rail 從 ChatView 解耦**：rail 不再是 ChatView 的 child，改由 pane 層級管理

## Capabilities

### New Capabilities
- `provider-flatten`: AppProviders 巢狀扁平化，減少 context 層級
- `dialog-extraction`: Workspace dialog state 抽出為獨立管理單元
- `unified-pane-header`: session pane 與 tool pane 共用 Pane.Toolbar 結構
- `shared-view-render`: DrawerHost 與 RightPane 共用 view body 渲染邏輯
- `rail-decoupling`: RightPane 從 ChatView 內部解耦到 pane tree 層級

### Modified Capabilities

## Impact

- `apps/web/src/App.tsx` — AppProviders 結構
- `apps/web/src/components/workspace/Workspace.tsx` — dialog state 抽出
- `apps/web/src/components/workspace/TabContainer.tsx` — pane environment
- `apps/web/src/components/workspace/PaneTree.tsx` — leaf 渲染路徑
- `apps/web/src/components/workspace/Pane.tsx` — 統一 toolbar
- `apps/web/src/components/workspace/DrawerHost.tsx` — 共用 view render
- `apps/web/src/components/workspace/RightPane.tsx` — rail 掛載點搬移
- `apps/web/src/components/chat/ChatView.tsx` — 移除 rightPane prop
- `apps/web/src/components/workspace/panes/PaneLeafBody.tsx` — 統一 header 路徑
- 相關測試檔案需隨結構調整 query 路徑
