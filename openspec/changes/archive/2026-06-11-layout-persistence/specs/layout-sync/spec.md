# layout-sync Specification

## Purpose

Layout 在 client ⇄ server 之間的持久化與多連線同步行為：wire versioning、rev echo guard、LWW rehydrate、channelId 重綁、dedup、view-state 保留。Codec 純函式層的行為見 `pane-tree-named-components` 的 `pane-codecs` spec。

## ADDED Requirements

### Requirement: Wire versioning with forward-safe migration

`persistedLayoutSchema` SHALL require `version: z.literal(2)`。Client 收到無 version 或 v1 payload SHALL 經 `migrateLegacyToV2` 升級後再 parse（session `{cwd}` → `{channelId: null, cwd}`）。Server SHALL 拒絕 version 低於現存的寫入。

#### Scenario: legacy v1 payload migrates instead of failing

- **WHEN** client 收到無 version 欄位的 v1 layout（app:init 或 sync）
- **THEN** payload SHALL 被升級為 v2 並正常 rehydrate，session leaf 的 cwd 保留為 hint

#### Scenario: stale-version write is rejected

- **WHEN** 舊版 client 對已存有 v2 layout 的 server 發出 v1 `layout:save`
- **THEN** server SHALL 拒收並以 ack 回報 `{ ok: false }`（不得讓降級資料覆蓋 v2）

### Requirement: Server-issued monotonic rev as echo guard

Server SHALL 對每次成功的 `layout:save` 配發單調遞增 rev；`layout:sync` 與 `app:init` 下行 payload SHALL 附 rev；save 的 ack SHALL 回傳新 rev。`layout:save` 上行 payload SHALL NOT 含 rev。Client SHALL 忽略 `rev <= lastSeenRev` 的 sync。

#### Scenario: echo does not loop

- **WHEN** browser A 儲存 layout 且 browser B 收到 sync 並套用
- **THEN** B 在 500ms debounce 後 SHALL NOT 將相同內容 echo 回 server（serialize 結果與 lastAppliedJson 相同即 skip）

#### Scenario: out-of-order sync is dropped

- **WHEN** client 已見 rev 17，收到 rev 16 的 `layout:sync`
- **THEN** payload SHALL 被忽略，不觸發 setWsState

### Requirement: layout:save is an acknowledged RPC

`layout:save` SHALL 為 callback ack 形式：parse 失敗回 `{ ok: false, error }` 並 `logger.warn`；成功回 `{ ok: true, rev }`。靜默丟棄 SHALL NOT 發生。

#### Scenario: invalid payload is observable

- **WHEN** `layout:save` payload 不符 schema
- **THEN** server SHALL 回 `{ ok: false }` 且記 warn log；store 與其他 client 不受影響

### Requirement: Rehydrate is LWW with render-time rebind

Rehydrate SHALL 整棵採用 incoming 樹（last-write-wins，不做 content-level merge）。Session leaf 的 channelId SHALL 由 render 層判斷存活：live → 以 mode:'resume' 重綁（session:join，SHALL NOT spawn 新 process）；非 live → empty pane ＋ cwd hint。

#### Scenario: live session rebinds across reload

- **WHEN** reload 後 app:init 帶回含仍存活 channelId 的 layout
- **THEN** 該 pane SHALL 直接重綁顯示對話內容，且 server SHALL NOT spawn 新 CLI process

#### Scenario: remote swap takes effect

- **WHEN** browser A swap 兩個 pane 的 content 並同步到 B
- **THEN** B SHALL 呈現 swap 後的配置（不得因「本地已綁」而拒套）

### Requirement: channelId uniqueness across the whole layout

一個 channelId SHALL 至多綁定一個 leaf（跨所有 workspace tabs）。實作採 **dedupe-and-accept**（比拒收寬容，與 ratio clamp 同屬 defensive restore 哲學）：server SHALL 於 store/broadcast 前以共用 util dedupe；client SHALL 於 apply 前以同一 util dedupe；首見保留、後續降級 empty leaf＋cwd hint。SHALL NOT 因重複 channelId 拒收整份 layout。

#### Scenario: duplicate channelId is deduped

- **WHEN** incoming layout 兩個 leaf 帶同一 channelId
- **THEN** 僅第一個 leaf 保留綁定，其餘 SHALL 降級為 empty pane（防 "Channel already exists" 雙 mount）

### Requirement: Sync preserves local view state

`layout:sync` SHALL NOT 覆寫本地 `activeWorkspaceTabId`（除非該 tab 已不存在於 incoming）；focusedPaneId / zoomedPaneId 指向仍存在的 pane 時 SHALL 保留。`activeTabId` SHALL 僅在 app:init 初次 rehydrate 套用。

#### Scenario: remote tab switch does not steal local view

- **WHEN** browser B 切換 workspace tab 觸發 save → sync
- **THEN** browser A 的 active tab SHALL 維持不變

### Requirement: Per-summoner isolation

Layout SHALL 以實際 summoner 識別為 key 儲存；`layout:sync` SHALL 僅廣播給同 summoner 的其他 socket。

#### Scenario: two summoners do not interfere

- **WHEN** summoner X 與 summoner Y 各自儲存 layout
- **THEN** 兩者的 get/save/sync SHALL 互不可見
