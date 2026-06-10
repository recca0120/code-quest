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

## Review Findings（2026-06-10 設計審查）

初版實作（commit `106c914d`）落地後，多 agent 審查發現以下問題，列為 P0 修正（tasks.md §9）：

### F1. save↔sync 回音迴圈（high）

`layout:sync` 觸發 `rehydrateFromLayout` → `setWsState`（整組取代、無內容比對）→ 觸發 debounced save effect → 500ms 後 emit `layout:save` → server 再廣播。兩個以上連線時形成永不收斂的 echo loop（A save → B sync → B save → A sync → …）。`layout-persistence.test.tsx` 還把「sync 後會 save」固化成預期行為。

> Decision 4 的 last-write-wins 假設「使用者同時只用一個 browser」，但 echo loop 不需要使用者操作就會自激。
> **修正方向（v2 修訂，取代原 lastSyncedJson 主案）**：server 對每次 save 配發**單調遞增 rev**，`layout:sync` 與 `app:init` 都附 rev，client 忽略 `rev <= lastSeenRev` 的 sync——同時免疫 JSON key 順序問題並阻擋混版 client 互寫。client 端 `lastAppliedJson`（以 canonical serializer 輸出比對，不拿 raw incoming 字串比）作第二道保險：save 前 serialize 相同即 skip。前提是 `serialize∘deserialize ≡ identity`（pane-tree-named-components D3 的硬性契約）——deserialize 有損時任何 guard 都擋不住。

### F2. worktrees pane 讓整份 layout 靜默失效（high）

`serializePaneNode` 對非 session/spec content 走 `as { type: 'files' | 'git'; cwd: string }` cast，`type:'worktrees'`（無 cwd）原樣輸出；`persistedPaneContentSchema` 沒有此 variant，server `safeParse` 失敗後 silent return——不存、不廣播、不 log。只要任一 pane 是 worktrees，所有 layout 變動全部丟失且無法察覺。

> **修正方向**：schema 加 `{ type: 'worktrees' }`；serialize/deserialize 改窮舉 switch（讓新增 PaneContent variant 時編譯期報錯）；server parse 失敗至少 `logger.warn`。

### F3. session leaf 寫死 `cwd: null`，違反 Decision 1（high）

Decision 1 明定 session pane 存 `cwd` 作為恢復提示，但 `serializePaneNode` 硬編 `{ type: 'session', cwd: null }`（client 端 PaneContent 只有 sessionId 沒有 cwd，而 cwd 就在同 provider 的 `tabs[sessionId].cwd`）。後果：reload 後 pane 變成毫無上下文的空白 picker，使用者要靠記憶重新指認每個 pane。

另外 rehydrate 是整組取代 + sessionId 一律歸 null，**reconnect / 其他分頁動一下 layout 都會把正在對話中的 pane 拆綁成空白**（session 退到 hidden pool，畫面上消失）。

> **修正方向（v2 修訂，取代原「serializeLayout 接 tabs map ＋ reconcile merge」案）**：
> - session leaf 存 `{ channelId, cwd }`——cwd 在**綁定當下**寫進 client content（`setSessionInPane(paneId, sessionId, cwd)`，pane-tree-named-components D1），serialize 是純 tree function，不查 tabs map（save effect deps 只有 `[wsState]`，timer fire 時 tabs 必然 stale）
> - **deserialize 無條件保留 channelId/cwd**，存活判斷在 render time：`tabs[sessionId]` 有 meta → TabContent 重綁（mode:'resume' 不 spawn）；缺席 → EmptyPane ＋ cwd hint。sessions 晚到自動 self-heal，session:dead 自動降級——杜絕「sync 路徑 sessions 未到 → 活 session 被判死 → 拆綁 layout 寫回 server 毀掉全域」的災難路徑
> - **不做 merge-by-leaf-id**（它想保護的 React mount 身份不存在——渲染無 key、positional reconcile；且會永久擋掉 remote swap）。結構整棵採用（LWW），mount 穩定靠 PaneLeaf `key={node.id}`
> - **dedup pass**：跨所有 workspace tabs，每個 channelId 只允許綁一個 leaf（防雙 mount "Channel already exists"），多餘降級 empty＋hint；schema `.refine` 全域唯一，server 拒收違規 payload
> - **view state 規則**：activeTabId 只在 app:init 初次套用，sync 時保留本地（除非該 tab 已不存在）；focused/zoomed 指向仍存在的 pane 則保留——「同步結構」≠「同步視圖」，否則 B 切分頁會搶走 A 的畫面

### F4. persistence key 硬編 `'default'`，違反 Decision 3（medium）

`LAYOUT_SUMMONER_KEY = 'default'` 使全 server 共用一份 layout；`LayoutStore` 的 per-summoner 隔離測試驗證的行為在 production 路徑不存在。桌機/手機同開時互相覆寫（疊加 F1 會持續互打）。broadcast 也是 `broadcastAllExcept` 全站廣播而非 per-summoner scoped。

> **修正方向**：key 接上實際 summoner 識別，broadcast 改 scoped；中期考慮 per-client key（layout 本質是裝置相關的 UI 狀態，跨裝置同步應為顯式動作）。

### F5. memory-only 與 session 持久化行為不一致（low，維持 out of scope）

server 已有 sessionStore/settingsStore 落盤，使用者心智模型是「session 重啟後還在，layout 應該也在」。維持 out of scope，但若後續要做，`LayoutStore` 介面不變、只換注入實作（包 settingsStore 寫 `layout:{key}` JSON）即可。

---

## Wire Schema v2（2026-06-10 修訂，配合 pane-tree-named-components）

```jsonc
{
  "version": 2,                          // 必填 z.literal(2)；趁尚無部署資料直接定版
  "rev": 17,                             // server 配發，單調遞增（F1 echo guard）
  "tabs": [{
    "id": "tab-1", "label": "main",
    "paneRoot": {
      "type": "split", "id": "s1", "direction": "h", "ratio": 0.6,
      "first":  { "type": "leaf", "id": "p1",
                  "content": { "type": "session", "channelId": "ch-abc", "cwd": "/repo/feat-x" } },
      "second": { "type": "leaf", "id": "p2",
                  "content": { "type": "git", "target": { "kind": "fixed", "cwd": "/repo/feat-x" } } }
    }
  }],
  "activeTabId": "tab-1"
}
```

| 變更 | 理由 |
|---|---|
| `version: 2` 必填 | 混版 client 防護：zod strip 會讓舊 client 靜默剝掉新欄位再存回（降級資料）。migration chain 與 schema 同檔（schemas package）；server 拒絕 version 低於現存的寫入 |
| `rev` server 配發 | F1 echo guard ＋ 混版互寫終結 |
| session 存 `{ channelId, cwd }` | channelId 用於**重綁仍存活的 session**（reload 後 server process 還在，mode:'resume' join 不 spawn——不違反 Decision 5 的不自動建立）；cwd 是 EmptyPane 還原 hint。branch/projectName **不入 wire**（runtime 反查，checkout 改名才不 stale） |
| tool pane `target: { kind:'fixed', cwd } \| { kind:'follow' }` | 預留 worktree-centric D5 follow mode，免 v3 migration；目前只實作 fixed |
| `{ type:'worktrees' }` variant | 修 F2 |
| unknown content variant → 降級 empty leaf | 新 pane type 不會讓舊 client 整份 parse 失敗（F2 的 wire 端對偶） |
| `layout:save` 加 ack callback | parse 失敗回 `{ ok:false }`，終結靜默丟棄；成功回新 rev |
| 不持久化 | focusedPaneId / zoomedPaneId / rightOpen / title（runtime 資料） |

Restore 決策表（session leaf）：

| 條件 | 行為 |
|---|---|
| channelId ∈ live sessions（tabs 有 meta） | render TabContent，mode:'resume' 重綁 |
| channelId ∉ live（或 null） | render EmptyPane ＋「上次: {project} ⎇ {branch}」（cwd 反查） |
| 重綁後 join 失敗 / session:dead | removeTab → meta 消失 → 同一 leaf **自動**降級 EmptyPane（render-time liveness 的免費收斂） |
| sessions 晚到（sync 路徑） | meta 出現 → 同一 leaf 自動從 EmptyPane 切回 TabContent（self-heal） |

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
