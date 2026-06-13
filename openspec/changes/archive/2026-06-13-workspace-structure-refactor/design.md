## Context

目前 workspace 的元件結構：

```
App → AppProviders (8 層 context) → Workspace → TabProvider → DrawerProvider
  → KeyboardShortcutsProvider → TabContainer → PaneEnvironmentProvider
    → PaneTree → PaneLeaf → PaneLeafBody
      → SessionPane → PaneShell + TabContent → ChannelProvider → ChatView
          → ChatShell + [rail wrapper → RightPane → Files/Git/Spec]
      → GitPane/FilesPane/OpenspecPane → PaneShell → View
    → DrawerHost (fixed overlay) → GitView/FilesView/SpecView
```

問題：
1. RightPane 活在 ChannelProvider 裡面（session 的 child），但它展示的 files/git/spec 與 AI 對話無關
2. DrawerHost 的 `renderDrawerBody()` 和 tool-panes 的 `createToolPane().renderView()` 各自 mount 同一組 View
3. SessionPane 和 tool-panes 有各自的 toolbar 組裝路徑（但最終都走 PaneShell）
4. Workspace.tsx 管 5 個 dialog state，每個 dialog 要各自的 open/close callback
5. AppProviders 8 層巢狀，部分 Provider 可合併或不需要包裹整棵樹

## Goals / Non-Goals

**Goals:**
- 降低元件巢狀層級和認知負擔
- 統一 view 渲染路徑（DrawerHost、RightPane、tool-pane 共用）
- 讓 rail 不再依賴 ChannelProvider
- 每個 dialog 自管 open state（從 Workspace 抽出）
- 維持所有既有行為和視覺不變（pure refactoring）
- 每個子 change 可獨立 merge，不依賴其他子 change 的完成

**Non-Goals:**
- 不改變任何使用者可見的 UI（佈局、動畫、互動行為）
- 不改變 pane tree 的資料模型或 TabContext 的 API
- 不引入新的 design token 或 CSS
- 不改變 socket/RPC 的通訊協議
- 不合併或拆分 Context 的 state/actions 分離模式

## Decisions

### D1: Provider 扁平化策略

**現狀**：`SessionProvider → PluginProvider → ProjectProvider → NavigationProvider → GitProvider → FsProvider → OpenspecProvider → CommandPaletteProvider`

**決策**：用一個 `composeProviders` utility 將 8 層寫成扁平陣列：
```tsx
const AppProviders = composeProviders([
  SessionProvider, PluginProvider, ProjectProvider,
  NavigationProvider, GitProvider, FsProvider,
  OpenspecProvider, CommandPaletteProvider,
]);
```
不改變任何 Provider 的實作或 context value 結構。純粹是 JSX 巢狀 → 陣列宣告的語法糖。

**Why**：減少巢狀視覺噪音，新增/移除 Provider 只動一行。

### D2: Dialog state 抽出為 DialogHost

**現狀**：Workspace 管 `dialogOpen` / `settingsOpen` / `worktreeDialogOpen` / `panePickerOpen` + 對應 setter + handler。

**決策**：建一個 `DialogHost` 元件（或 context），每個 dialog 自帶 trigger：
- `AddProjectDialog` 自管 open state，Workspace 只呼叫 `openAddProject()`
- `SettingsDialog` 自管 open state
- `CreateWorktreeDialog` 自管 open state
- PanePicker 已有 `CommandPaletteContext`，整合進去

Workspace 只保留 `pendingSession` state（因為它跨 dialog 流動）。

**Why**：Workspace 瘦身；每個 dialog 的開/關邏輯內聚。

### D3: 統一 view body 渲染

**現狀**：三處各自 mount view：
1. `tool-panes.tsx` 的 `createToolPane({ renderView })` → 獨立 pane 用
2. `RightPane` 的 TabContent 裡直接 `<GitView cwd={cwd} />`
3. `DrawerHost` 的 `renderDrawerBody(content)`

**決策**：抽一個純函式 `renderPaneView(type, cwd)` 回傳 `ReactNode`：
```tsx
function renderPaneView(type: 'git' | 'files' | 'openspec', cwd: string): React.ReactNode {
  switch (type) {
    case 'git': return <GitView cwd={cwd} />;
    case 'files': return <FilesView cwd={cwd} />;
    case 'openspec': return <SpecView cwd={cwd} />;
  }
}
```
三處全部改呼叫此函式。

**Why**：DRY；未來新增 view 類型只改一處。

### D4: PaneLeafBody 已統一（現狀確認）

看過程式碼後確認：PaneLeafBody 的 switch 已經透過 `PaneShell` + `toolbarProps` 統一了 toolbar 結構。SessionPane 和 tool-panes 都走 `PaneShell.Toolbar`。

**決策**：此項不需要額外重構。SessionPane 內部的 rail 管理（open/tab/width）是 session 特有邏輯，留在原處合理。

**狀態**：已達成，不開子 change。

### D5: Rail 從 ChatView 解耦

**現狀**：
- `SessionPane` 建構 `<RightPane>` 傳給 `TabContent` 的 `rightPane` prop
- `TabContent` 傳給 `ChatView` 的 `rightPane` prop
- `ChatView` 在自己的 flex 裡渲染 `<div data-testid="chat-rail-wrapper">{rightPane}</div>`

**決策**：
- `SessionPane` 改為自己在 PaneShell body 裡做 flex 分割：左側 `TabContent`（純 chat）、右側 `RightPane`
- 移除 `TabContent.rightPane` 和 `ChatView.rightPane` prop
- `ChatView` 變成純 chat UI（MessageList + InputArea），不再知道 rail 的存在

結構變為：
```
PaneShell
  └─ <div.flex>
       ├─ TabContent (只有 chat)
       └─ RightPane (rail，同級)
```

**Why**：
- Rail 不再被包在 ChannelProvider 裡
- ChatView 變成純粹的「聊天 UI」，職責單一
- RightPane 的 cwd 直接從 SessionPane 取得，不經過 channel

**注意**：`railWidth` inline style 原本由 ChatView 的 rail wrapper 管理，搬到 SessionPane 後由同一個 `<div>` 帶 style。視覺不變。

## Risks / Trade-offs

### 風險
- **Rail 解耦後 ChannelProvider 的 scope 變窄**：如果 RightPane 未來需要讀 channel state（例如顯示當前對話的 mentioned files），需要額外 bridge。目前 RightPane 完全不讀 channel state，所以沒問題。
- **Dialog 抽出後跨 dialog 流程變複雜**：例如 CreateWorktreeDialog 完成後要設 pendingSession。用 callback prop 或 event 解決。

### Trade-off
- `composeProviders` 引入一個小 utility，但換來可讀性提升值得
- 每個子 change 都是 pure refactoring（行為不變），可安全分別 merge
- 子 change 之間有輕微依賴順序（D5 依賴 D3 的 `renderPaneView` 存在），但每個都可獨立通過所有測試
