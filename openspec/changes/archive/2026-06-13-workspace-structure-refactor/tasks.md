## 子 change 拆分計劃

此主 change 為北極星（design + spec only），不直接 apply。實作透過以下子 change 逐一完成：

### Phase 1: 低風險、無依賴
- [x] **子 change: provider-flatten** — composeProviders utility + AppProviders 改寫（spec: provider-flatten）
- [x] **子 change: dialog-extraction** — dialog state 從 Workspace 抽出（spec: dialog-extraction）
- [x] **子 change: shared-view-render** — 抽 renderPaneView 共用函式（spec: shared-view-render）

### Phase 2: 依賴 Phase 1
- [x] **子 change: rail-decoupling** — RightPane 從 ChatView 解耦到 SessionPane 層（spec: rail-decoupling；依賴 shared-view-render）

### 完成條件
- 所有子 change archived
- 所有既有測試通過
- tsc clean
- 使用者可見的 UI 行為零變更
