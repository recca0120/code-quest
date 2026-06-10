# Client Structure Cleanup — Tasks

## 1. TabContext 拆分

- [ ] 1.1 [refactor] 純樹演算法＋PaneNode/PaneContent 型別移到 `contexts/pane-tree.ts`（零 React import；消除與 pane-codecs 的 type-only cycle；TabContext re-export 型別保持 17 個 consumer 零改動）
- [ ] 1.2 [test] `useLayoutPersistence(wsState, setWsState)` hook — echo guard／rev／applyLayout 行為與現有 layout-persistence.test.tsx 等價（測試本來就在 provider 層，零搬動）
- [ ] 1.3 [refactor] persistence 區塊抽 hook（soft-bound socket/appConfigActions 維持「測試可不掛 SocketProvider」）
- [ ] 1.4 [refactor] 拆 `WorkspaceLayoutProvider`(workspaceTabs+panes+persistence) 與瘦身後 `TabProvider`(session meta+sessions diff+intents)；Workspace 巢狀掛載；hooks 原路徑 re-export
- [ ] 1.5 [refactor] export `useWorkspaceTabState` / `useWorkspaceTabActions` 細粒度 hook（比照 AppInitContext）
- [ ] 1.6 [refactor] 測試 harness 更新（render-with-channel、story-decorator）；全套綠

## 2. 職責歸位

- [ ] 2.1 [refactor] SessionBar 量測下放（SESSION_TAB_WIDTH_PX/ResizeObserver/maxVisible 移入 SessionBar；TabContainer 移除 ref/state/effect）
- [ ] 2.2 [refactor] `socket.connect()`（含 connect_error toast）上提到 App.tsx 建 socket 的 effect；SessionProvider 只留 session 事件訂閱
- [ ] 2.3 [refactor] SessionPool 從 workspaceTabs 單一來源推導兩個集合（移除 usePaneState 依賴）

## 3. 死碼與 doc rot

- [ ] 3.1 [refactor] 移除 PendingActivateChannel.cwd / PendingOpenWorktree.projectCwd 欄位＋呼叫端簽名；NavigationContext/TabProvider props 註解更新為全域模型
- [ ] 3.2 [decision+impl] onMention：FilesView onMention 改 optional＋缺席時隱藏 mention UI（或接通 PaneEnvironment→composer）；移除兩處 noop placeholder

## 4. Edge case

- [ ] 4.1 [test] TabProvider remount（移除最後 project 再加回）— 不得以舊 layout 覆寫較新的已存 layout
- [ ] 4.2 [impl] AppConfigProvider 監聽 layout:sync 更新 lastInitRef（含 rev），subscribeInit replay 帶 rev；或 remount 重新 emit app:init
