# Client Structure Cleanup

## Why

2026-06-11 client 結構審查（4 視角）後，bugs 與快速殘留已當場修掉（Workspace callback identity、sessions diff 錯殺 active tab、handleCreateTab tool-pane fallback、activeTabId membership guard、PaneZoomProvider 併入 KeyboardShortcutsProvider、ToolPanes→WorktreesPane 改名、WorktreeOption 收斂、renderLeaf 移除、memo(PaneLeafBody)）。本 change 收錄**延後的結構性項目**——成本較高或需要決策，不適合順手修。

## What Changes

### 1. TabContext 拆分（主項）

TabProvider 承擔 6 個職責，其中 tabs domain（session meta map + sessions diff + navigation intents）與 layout domain（workspaceTabs + panes + persistence）**零共享變數**，只是住同一個函式體：

- 拆成 `TabProvider`（~300 行）與 `WorkspaceLayoutProvider`（~400 行），Workspace 巢狀掛載；hooks 從原路徑 re-export → 17 個 consumer 零改動
- 純樹演算法（splitNode/closeNode/collectSessionsInPaneTree…）連同 `PaneNode`/`PaneContent` 型別移到 `pane-tree.ts` 純模組（比照 pane-codecs 先例），消除與 pane-codecs 的 type-only import cycle
- layout persistence 抽 `useLayoutPersistence(wsState, setWsState)` hook——echo-guard 不變量成為具名單元
- 比照 AppInitContext export `useWorkspaceTabState` / `useWorkspaceTabActions` 細粒度 hook

### 2. 職責歸位

- **SessionBar 量測下放**：`SESSION_TAB_WIDTH_PX` + ResizeObserver + maxVisible 公式從 TabContainer 移入 SessionBar（presentation 細節不該上漏）
- **socket.connect() 上提**：連線生命週期從 SessionProvider 移到 App.tsx 建 socket 的 effect（目前外層 AppConfigProvider 的 app:init 鏈靠內層 SessionProvider 去 connect——隱藏的外層→內層依賴）
- **SessionPool 單源化**：inactiveTabSessionIds 與 allPaneSessions 改從 workspaceTabs 單一來源推導（目前混用 usePaneState().paneRoot）

### 3. 死碼與 doc rot

- Navigation intent 的 `cwd`/`projectCwd` 欄位已無消費者（TabProvider 全域化後）——移除欄位＋更新呼叫端簽名；NavigationContext 與 TabProvider props 的「per-project scoped」註解更新為全域模型（可併 worktree-centric D1 清理）
- **onMention 決策**：files pane 與 RightPane 的 mention affordance 全是 noop——改 FilesView 的 onMention 為 optional 並在缺席時隱藏 UI（誠實），或經 PaneEnvironment 接到 focused session composer

### 4. Edge case

- **TabProvider remount 重播過期 layout**：subscribeInit 對新訂閱者重播 connect 時的舊快照，remount 的 TabProvider lastSeenRev 從 0 起算擋不住——讓 AppConfigProvider 同步監聽 layout:sync 更新 lastInitRef（含 rev），或 remount 時重新 emit app:init

## Impact

- 影響檔案：TabContext.tsx（拆分）、Workspace.tsx、TabContainer.tsx、SessionBar.tsx、SessionContext.tsx、App.tsx、NavigationContext.tsx、panes/SessionPool.tsx、FilesView
- 不改行為（除 onMention UI 誠實化）；測試 harness（render-with-channel、story-decorator）需跟拆分更新
- 注意 memory 教訓：拆分涉及共用型別搬移，**單線依序做，不可平行 agent**
