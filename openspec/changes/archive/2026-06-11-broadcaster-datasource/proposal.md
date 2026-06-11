## Why

現有的 `DirtyBroadcaster` + `WatchService` 架構把「偵測變更」和「讀取資料」分成兩層，前端收到 dirty signal 後還要自己 re-fetch，造成兩段式 round-trip，且快取、remote mode 支援都難以統一處理。

初版重構（已完成）把三個 domain（files、git、openspec）各自抽成 `DataSource<T>`，並用三個獨立的 `Broadcaster<T>` 管理訂閱。但這個設計暴露了一個協議層的問題：remote mode 下，server 的三個 `RemoteBroadcaster` 各自向 Agent 發 `watch.start`，Agent 以 cwd 為 key 儲存訂閱，第二次 `watch.start` 會覆蓋第一次，造成訂閱洩漏。

根本原因是：**WatchService 本來就只需要一個 watcher per cwd**，三個 Broadcaster 各自訂閱同一個 cwd 是重複的。正確的設計是一個 `Broadcaster` 持有多種 DataSource，一次 subscribe 涵蓋所有 type，watcher 只開一次。

## What Changes

- 重新設計 `Broadcaster`：從 `Broadcaster<T>`（單一型別）改為多型別，持有多個命名的 DataSource
- `subscribe(cwd, subscriberId, cb)` 的 `cb` 接收 `(type, data)` 而非單一型別的 `data`
- 三個 `Broadcaster<T>` 合併為一個 `Broadcaster` 實例（files + git + openspec 全部在裡面）
- Remote mode：一個 `watch.start` / `watch.stop` 對應一個 `Broadcaster.subscribe` / unsubscribe，ref count 問題自然消失
- Local mode：server 直接持有一個 `Broadcaster` in-process reference，不需要三個分開的 binding
- `RemoteBroadcaster` 配合更新，訂閱單一 channel 收到 typed snapshot

## Capabilities

### Modified Capabilities
- `broadcaster-datasource`: Broadcaster 改為多型別設計，一次訂閱涵蓋 files + git + openspec，解決 remote mode watch.start 覆蓋問題

## Impact

- `packages/broadcaster/src/broadcaster.ts` — 重新設計 API，不再是泛型
- `apps/server/src/container.ts` — 三個 Broadcaster binding 合併為一個
- `apps/server/src/remote/remote-broadcaster.ts` — 配合新介面更新
- `apps/summoner/src/connection/watch-handlers.ts` — 簡化，直接用一個 Broadcaster
- `apps/summoner/src/connection/agent.ts` — 移除 watchService / openspec 個別參數，改接 Broadcaster
