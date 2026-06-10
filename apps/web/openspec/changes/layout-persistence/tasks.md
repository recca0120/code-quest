# Layout Persistence — Tasks

## Server 端

### Schema

- [ ] 1.1 [test] `PersistedLayout` Zod schema — 驗證合法結構（leaf/split pane node、content type、tabs/activeTabId）
- [ ] 1.2 [impl] 在 `packages/schemas` 新增 `PersistedLayout` Zod schema 及對應 TypeScript types
- [ ] 1.3 [test] `app:init` response schema — 驗證 `layout` 為 optional `PersistedLayout | null`
- [ ] 1.4 [impl] `app:init` response schema 加入 `layout?: PersistedLayout | null`

### LayoutStore

- [ ] 2.1 [test] `LayoutStore.get(summonerId)` — 未設定時回傳 `null`
- [ ] 2.2 [test] `LayoutStore.set(summonerId, layout)` — 存入後 `get` 可取回相同值
- [ ] 2.3 [test] `LayoutStore.set` — 不同 summoner 資料互不干擾
- [ ] 2.4 [impl] 實作 `LayoutStore` class（memory-only Map，`get` / `set`）

### layout:save handler

- [ ] 3.1 [test] 收到 `layout:save` — 呼叫 `LayoutStore.set(summonerId, payload)`
- [ ] 3.2 [test] 收到 `layout:save` — 對同一 summoner 的其他 socket broadcast `layout:sync`（不回給自己）
- [ ] 3.3 [test] `layout:save` payload 不合 schema — 不存入、不 broadcast
- [ ] 3.4 [impl] 實作 `layout:save` WS handler

### app:init handler

- [ ] 4.1 [test] `app:init` ACK — `LayoutStore` 有資料時帶回 `layout: PersistedLayout`
- [ ] 4.2 [test] `app:init` ACK — `LayoutStore` 無資料時帶回 `layout: null`
- [ ] 4.3 [impl] 修改 `app:init` handler，帶回 `layout: store.get(summonerId) ?? null`

## Client 端

### app:init rehydrate

- [ ] 5.1 [test] `app:init` ACK 含 `layout` — TabContext 以收到的 tabs 與 activeTabId 取代初始狀態
- [ ] 5.2 [test] `app:init` ACK `layout` 為 `null` — TabContext 保持預設初始狀態
- [ ] 5.3 [impl] 在 `app:init` ACK callback 中，若 `layout` 非 null，rehydrate TabContext（workspaceTabs + activeWorkspaceTabId）

### debounced layout:save

- [ ] 6.1 [test] TabContext 狀態變動後 500 ms — emit `layout:save`（帶完整 PersistedLayout）
- [ ] 6.2 [test] 500 ms 內多次狀態變動 — 只 emit 一次 `layout:save`（debounce 去重）
- [ ] 6.3 [test] TabContext unmount — 取消 pending debounce，不再 emit
- [ ] 6.4 [impl] 在 TabContext 加入 debounced（500 ms）`layout:save` emit，監聽 tabs 與 activeTabId 變動

### layout:sync 跨裝置更新

- [ ] 7.1 [test] 收到 `layout:sync` — TabContext 的 tabs 與 activeTabId 更新為 payload 的值
- [ ] 7.2 [test] `layout:sync` payload 不合 schema — TabContext 狀態不變
- [ ] 7.3 [impl] 在 TabContext 監聽 `layout:sync` 事件，驗證 schema 後更新狀態

## Refactor

- [ ] 8.1 [refactor] 將 `LayoutStore` 注入 `app:init` handler 與 `layout:save` handler，確保兩者共用同一實例
- [ ] 8.2 [refactor] 確認 `ChannelManager` 與 `LayoutStore` 無耦合，各自 SRP
