## Context

Layout 持久化是 `workspace-tab-split-pane` change 的一部分（Decision 14），負責將 pane tree 結構透過 WebSocket 存在 server，使 browser 重整或切換裝置後能完整恢復 workspace 狀態。本文件將 Decision 14 的設計決策獨立整理，補充實作細節。

---

## Decisions

### 1. 持久化 schema：PersistedLayout

`sessionId` 是 runtime 概念（Channel 存活期間才有意義），不應持久化。PaneLeaf 改存 `cwd`，讓 server 能在重連時提示「從哪個目錄恢復」，而不是嘗試重建 session。

```ts
// sessionId 是 runtime 概念，不持久化；PaneLeaf session 改存 cwd
type PersistedPaneContent =
  | { type: 'session';  cwd: string | null }
  | { type: 'files';    cwd: string }
  | { type: 'git';      cwd: string }
  | { type: 'openspec'; cwd: string }

type PersistedPaneLeaf  = { type: 'leaf';  id: string; content: PersistedPaneContent }
type PersistedPaneSplit = { type: 'split'; id: string; direction: 'h' | 'v'; ratio: number;
                            first: PersistedPaneNode; second: PersistedPaneNode }
type PersistedPaneNode  = PersistedPaneLeaf | PersistedPaneSplit

type PersistedTab = { id: string; label?: string; paneRoot: PersistedPaneNode }
// focusedPaneId / zoomedPaneId 不持久化

type PersistedLayout = { tabs: PersistedTab[]; activeTabId: string }
```

**不持久化的欄位及理由：**

| 欄位 | 理由 |
|---|---|
| `sessionId` | runtime，Channel 存活期間才有，重連後需重新建立 |
| `focusedPaneId` | transient，預設為 `firstLeafId(paneRoot)` |
| `zoomedPaneId` | transient，zoom 是臨時 UI 狀態，不應跨裝置同步 |
| `rightOpen` | transient，預設 false |

---

### 2. WS Events 設計

`layout:load` / `layout:loaded` 不需要獨立設計，改為在 `app:init` ack 一次帶回，少一個 round trip。

| Event | 方向 | Payload | 說明 |
|---|---|---|---|
| `app:init` ack | server → client | `{ ...原有欄位, layout: PersistedLayout \| null }` | **修改**：ack payload 加入 layout |
| `layout:save` | client → server | `PersistedLayout` | debounce 儲存當下 layout（TabContext 狀態改變時） |
| `layout:sync` | server → client | `PersistedLayout` | 有其他 browser 更新 layout 時，廣播給其他連線（排除發送者） |

---

### 3. LayoutStore：memory-only，per summoner

每個 summoner 一份 layout（用 summonerId 為 key）。Server 重啟後 layout 清空，browser 重連收到 `null` 從預設狀態開始。

```ts
class LayoutStore {
  private store = new Map<string, PersistedLayout>()

  get(summonerId: string): PersistedLayout | null {
    return this.store.get(summonerId) ?? null
  }

  set(summonerId: string, layout: PersistedLayout): void {
    this.store.set(summonerId, layout)
  }
}
```

**理由**：不需要 DB，layout 是 workspace 的 UI 狀態，非資料。Server 重啟後從預設狀態開始可接受（session 仍然在 server 的 channel registry 內，只是 pane 結構消失）。

---

### 4. 同步策略：last-write-wins

兩個 browser 同時操作時，後寫入者獲勝，不做 conflict resolution。這對 layout 是合理的：使用者通常在同一時間只用一個 browser，race condition 頻率極低，last-write-wins 足夠。

---

### 5. Session 恢復策略：保守（不自動建立 session）

rehydrate 時所有 PaneLeaf session 的 `sessionId = null`（顯示 EmptyPanePicker + cwd 提示），使用者點擊後手動開 session。

**理由**：不自動建立 session，避免重整後同時開多個 session 造成資源浪費，也避免在使用者不知情的情況下自動執行 Claude process。

---

### 6. Client debounce 策略

每次 TabContext 狀態改變（split / close / resize / rename tab）後 debounce 500ms 才 emit `layout:save`。避免 resize 拖曳時每個 frame 都送 event。

---

## Data Flow

### 連線初始化（Browser reload）

```
Browser reload
  │
  ↓ emit app:init
  │
Server
  ├── 原有 app:init 處理（models、capabilities 等）
  └── layoutStore.get(summonerId) → PersistedLayout | null
  │
  ↓ ack { ...原有欄位, layout: PersistedLayout | null }
  │
Client
  ├── layout === null
  │     → TabContext 用預設狀態（單一空白 Tab）
  │
  └── layout !== null
        → rehydrate TabContext
            ├── tabs / activeTabId 恢復
            ├── 每個 PaneLeaf session 的 sessionId = null（顯示 EmptyPanePicker + cwd 提示）
            └── focusedPaneId = firstLeafId(activeTab.paneRoot)
                zoomedPaneId = null
```

### 多裝置同步（Tab 狀態變動）

```
Browser A（使用者操作 split / close / resize / rename）
  │
  ↓ (debounce 500ms) emit layout:save(PersistedLayout)
  │
Server
  ├── validate schema
  ├── layoutStore.set(summonerId, layout)
  └── socket.broadcast.emit("layout:sync", layout)  ← 排除 A 自己
        │
        ├── Browser B ← layout:sync(PersistedLayout)
        │     → rehydrate TabContext（同初始化 rehydrate 邏輯）
        │
        └── Browser C ← layout:sync(PersistedLayout)
              → rehydrate TabContext
```

### rehydrate 後的狀態重置（適用初始化與 layout:sync）

```
rehydrate(layout: PersistedLayout)
  ├── tabs = layout.tabs.map(deserializeTab)
  ├── activeTabId = layout.activeTabId
  └── 每個 Tab
        ├── focusedPaneId = firstLeafId(tab.paneRoot)
        ├── zoomedPaneId = null
        └── 每個 PaneLeaf（type === 'session'）
              └── sessionId = null
```

---

## Out of Scope

| 項目 | 說明 |
|---|---|
| DB 持久化 | layout 存在 memory，server 重啟後清空。正式 DB 持久化（SQLite / Redis）不在此 change 範圍 |
| 版本歷史 / Undo | 不記錄 layout 變更歷史，無法回滾到前一個 layout 狀態 |
| Conflict Resolution | 只做 last-write-wins，不解決同時操作的 merge conflict |
| Session 自動重建 | rehydrate 後 session pane 顯示 EmptyPanePicker，不自動重開 Claude process |
| Layout 匯出 / 匯入 | 不支援手動儲存 / 載入 layout 快照 |
| Cross-summoner 同步 | layout 以 summonerId 為 key，不同 summoner 的 layout 不互通 |
