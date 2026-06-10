# Layout Persistence — Tasks

## Server 端

### Schema

- [x] 1.1 [test] `PersistedLayout` Zod schema — 驗證合法結構（leaf/split pane node、content type、tabs/activeTabId）
- [x] 1.2 [impl] 在 `packages/schemas` 新增 `PersistedLayout` Zod schema 及對應 TypeScript types
- [x] 1.3 [test] `app:init` response schema — 驗證 `layout` 為 optional `PersistedLayout | null`
- [x] 1.4 [impl] `app:init` response schema 加入 `layout?: PersistedLayout | null`

### LayoutStore

- [x] 2.1 [test] `LayoutStore.get(summonerId)` — 未設定時回傳 `null`
- [x] 2.2 [test] `LayoutStore.set(summonerId, layout)` — 存入後 `get` 可取回相同值
- [x] 2.3 [test] `LayoutStore.set` — 不同 summoner 資料互不干擾
- [x] 2.4 [impl] 實作 `LayoutStore` class（memory-only Map，`get` / `set`）

### layout:save handler

- [x] 3.1 [test] 收到 `layout:save` — 呼叫 `LayoutStore.set(summonerId, payload)`
- [x] 3.2 [test] 收到 `layout:save` — 對同一 summoner 的其他 socket broadcast `layout:sync`（不回給自己）
- [x] 3.3 [test] `layout:save` payload 不合 schema — 不存入、不 broadcast
- [x] 3.4 [impl] 實作 `layout:save` WS handler

### app:init handler

- [x] 4.1 [test] `app:init` ACK — `LayoutStore` 有資料時帶回 `layout: PersistedLayout`
- [x] 4.2 [test] `app:init` ACK — `LayoutStore` 無資料時帶回 `layout: null`
- [x] 4.3 [impl] 修改 `app:init` handler，帶回 `layout: store.get(summonerId) ?? null`

## Client 端

### app:init rehydrate

- [x] 5.1 [test] `app:init` ACK 含 `layout` — TabContext 以收到的 tabs 與 activeTabId 取代初始狀態
- [x] 5.2 [test] `app:init` ACK `layout` 為 `null` — TabContext 保持預設初始狀態
- [x] 5.3 [impl] 在 `app:init` ACK callback 中，若 `layout` 非 null，rehydrate TabContext（workspaceTabs + activeWorkspaceTabId）

### debounced layout:save

- [x] 6.1 [test] TabContext 狀態變動後 500 ms — emit `layout:save`（帶完整 PersistedLayout）
- [x] 6.2 [test] 500 ms 內多次狀態變動 — 只 emit 一次 `layout:save`（debounce 去重）
- [x] 6.3 [test] TabContext unmount — 取消 pending debounce，不再 emit
- [x] 6.4 [impl] 在 TabContext 加入 debounced（500 ms）`layout:save` emit，監聽 tabs 與 activeTabId 變動

### layout:sync 跨裝置更新

- [x] 7.1 [test] 收到 `layout:sync` — TabContext 的 tabs 與 activeTabId 更新為 payload 的值
- [x] 7.2 [test] `layout:sync` payload 不合 schema — TabContext 狀態不變
- [x] 7.3 [impl] 在 TabContext 監聽 `layout:sync` 事件，驗證 schema 後更新狀態

## Refactor

- [x] 8.1 [refactor] 將 `LayoutStore` 注入 `app:init` handler 與 `layout:save` handler，確保兩者共用同一實例
- [ ] 8.2 [refactor] 確認 `ChannelManager` 與 `LayoutStore` 無耦合，各自 SRP

## P0 修正（2026-06-10 design review，詳見 design.md Review Findings）

### F1 — save↔sync 回音迴圈（v2 修訂：rev 機制取代 lastSyncedJson 主案）

- [ ] 9.1 [test] server `layout:save` — 每次成功儲存 rev 單調遞增，ack 回傳新 rev，`layout:sync` 與 `app:init` payload 附 rev
- [ ] 9.2 [impl] `LayoutStore` 加 rev counter；handler ack/broadcast 帶 rev
- [ ] 9.3 [test] client 收到 `rev <= lastSeenRev` 的 sync — 忽略，不觸發 setWsState
- [ ] 9.4 [test] client 收到新 rev 的 sync — 套用後 500ms 內不 echo 回 `layout:save`（serialize 結果與 lastAppliedJson 相同即 skip）
- [ ] 9.5 [impl] TabContext 記錄 lastSeenRev ＋ lastAppliedJson（以 canonical serializer 輸出比對）；save effect emit 前比對、成功 emit 後更新

### F2 — worktrees pane 靜默失效（大部分被 §13 v2 schema 與 pane-tree-named-components §B codecs 吸收）

- [ ] 10.1 ~~schema worktrees variant~~ → 併入 13.1/13.2
- [ ] 10.2 ~~mapped-type codecs 移除 as cast~~ → 併入 pane-tree-named-components 2.3/2.5
- [ ] 10.3 [impl] server `safeParse` 失敗時 `logger.warn(parsed.error)`（13.7 ack 落地前的最低限度可觀測性）

### F3 — session 重綁 ＋ LWW rehydrate（v2 修訂：render-time liveness 取代 reconcile merge；依賴 pane-tree-named-components A/B）

- [ ] 11.1 ~~serialize 帶 {channelId,cwd}~~ → 併入 pane-tree-named-components 1.1/1.2
- [ ] 11.2 ~~deserialize 無條件保留＋roundtrip property test~~ → 併入 pane-tree-named-components 2.1/2.2
- [ ] 11.3 ~~走 pane-codecs~~ → 併入 pane-tree-named-components 2.5
- [ ] 11.4 [test] rehydrate — 結構整棵採用（LWW）；channelId 仍 live 的 leaf 經 render-time 判斷自動重綁（mode:'resume'，不 spawn）
- [ ] 11.5 [test] rehydrate dedup — incoming 多個 leaf 帶同一 channelId — 只保留第一個，其餘降級 empty＋hint（防 "Channel already exists" 雙 mount）
- [ ] 11.6 [impl] deserializeLayout 出口 dedup pass；schema `.refine` channelId 全域唯一；server 拒收違規 payload
- [ ] 11.7 [test] view state — `layout:sync` 不覆寫本地 activeWorkspaceTabId（除非該 tab 已不存在）；focused/zoomed 指向仍存在的 pane 則保留
- [ ] 11.8 [impl] rehydrateFromLayout 拆 init 路徑（套用 activeTabId）與 sync 路徑（保留本地 view state）
- [ ] 11.9 [test] rehydrate 完成後 emit `session:closed` — 該 pane 自動降級 empty-pane（render-time liveness 收斂）
- [ ] 11.10 [test] EmptyPane — 還原的 session leaf 顯示「上次：{project} ⎇ {branch}」提示（content.cwd 反查 listing，不入 wire）

### F4 — per-summoner key

- [ ] 12.1 [test] `layout:save` / `app:init` — 以實際 summoner 識別為 key，不同 summoner 互不干擾（production 路徑）
- [ ] 12.2 [impl] 移除 `LAYOUT_SUMMONER_KEY = 'default'`，handler 從 socket/HandlerContext 取得 summoner 識別
- [ ] 12.3 [test] `layout:sync` — 只廣播給同 summoner 的其他 socket
- [ ] 12.4 [impl] broadcast 改 scoped（channel-emitter 增加 per-summoner 廣播或 filter）

### Wire Schema v2（design.md「Wire Schema v2」；依賴 pane-tree-named-components A/B 的 content shape）

- [ ] 13.1 [test] schema v2 — `version: z.literal(2)` 必填；session `{ channelId, cwd }`；tool pane `target` union；worktrees variant；ratio `z.number().catch(0.5)`（clamp 不 reject，見 pane-tree 2.8）；rev **不在** save schema（僅下行 payload 攜帶）
- [ ] 13.2 [impl] `persistedLayoutSchema` v2 改版（schemas package）
- [ ] 13.3 [test] migration — 無 version / v1 payload 經 `migrateLegacyToV2` 升級（session cwd → channelId:null + cwd）
- [ ] 13.4 [impl] migration chain 與 schema 同檔；client parse 失敗先過 migration
- [ ] 13.5 [test] unknown content variant — 降級為 empty leaf，不讓整份 layout parse 失敗
- [ ] 13.6 [impl] `persistedPaneContentSchema` 加 unknown-variant 容錯（catch-all → empty）
- [ ] 13.7 [test] `layout:save` ack — parse 失敗回 `{ ok:false, error }`；成功回 `{ ok:true, rev }`
- [ ] 13.8 [impl] `layout:save` 改 RPC 形式（callback ack）；server 拒絕 version 低於現存的寫入
