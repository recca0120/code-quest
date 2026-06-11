## 已完成

- [x] 建立 `packages/broadcaster/` package（types.ts、cached.ts、datasources/）
- [x] 實作 `DataSource<T>`、`CachedDataSource<T>`
- [x] 實作 `FilesDataSource`、`GitDataSource`、`OpenspecDataSource`
- [x] 重新設計 `Broadcaster` API：移除泛型，改為 `add(type, createSource)` + `subscribe(cwd, id, cb(type, data))`
- [x] 新增 `AgentHandler` interface
- [x] `FsHandler`、`GitHandler`、`BroadcasterHandler` 實作 `AgentHandler`
- [x] `Agent` 改為 `(processProvider, handlers: AgentHandler[])` constructor
- [x] 更新 `RemoteBroadcaster`：移除泛型，cb 收 `(type, data)`，加 `dispose()`
- [x] Server `container.ts`：改用單一 `TYPES.Broadcaster`
- [x] Server `SocketServer`：改注入單一 `Broadcaster`
- [x] Server `subscribeSnapshotForSocket`：統一 broadcaster type dispatch
- [x] 更新 broadcaster、server、summoner 測試
- [x] Broadcaster correctness：`hasValue` flag、in-flight dedup、stale-cb guard、error logging

## 待完成

### 8. DataSource 重構

- [x] 8.1 `DataSource<T>` 從 interface 改為 abstract class，搬到 `data-source.ts`
- [x] 8.2 資料夾 `datasources/` → `data-sources/`
- [x] 8.3 `files.ts` → `files-data-source.ts`，改 `extends DataSource`
- [x] 8.4 `git.ts` → `git-data-source.ts`，改 `extends DataSource`
- [x] 8.5 `openspec.ts` → `openspec-data-source.ts`，改 `extends DataSource`
- [x] 8.6 刪 `watch-callbacks.ts`、`matchers.ts`
- [x] 8.7 刪 `cached.ts` + `cached.test.ts`，移除所有使用端的 `CachedDataSource` 包裝
- [x] 8.8 更新 `index.ts` exports
- [x] 8.9 更新 summoner `container.ts` + broadcaster-handler test

### 6. ProcessHandler 重構

- [x] 6.1 新增 `ProcessHandler implements AgentHandler`：
  - 持有 `processProvider` 和 `spawned: Map<string, ProcessHandle>`
  - `attach(rpc)` 註冊 process/spawn、process/stdin、process/kill
  - `attach` 內部保存 `rpc` 引用（取代 Agent 的 `this.rpc`）
  - `dispose()` abort 所有 spawned processes
  - `streamProcess`、`streamStderr` 搬進 ProcessHandler

- [x] 6.2 `AgentHandler` interface 加 `dispose?(): void`

- [x] 6.3 更新 `Agent`：
  - 移除 `processProvider` constructor param（改由 ProcessHandler 持有）
  - 移除 `this.rpc`、`emitViaRpc`、所有 process 相關方法
  - `dispose()` 委派：`handlers.forEach(h => h.dispose?.())`
  - `attach()` 純粹：`handlers.forEach(h => h.attach(rpc))`

- [x] 6.4 更新 `main.ts`：改為 `new Agent([new ProcessHandler(processProvider), new FsHandler(fs), ...])`

- [x] 6.5 更新測試（agent.test.ts、reconnect.test.ts）

### 7. fs-handlers / git-handlers inline

- [x] 7.1 將 `fs-handlers.ts` 的內容 inline 到 `fs-handler.ts`，刪除 `fs-handlers.ts`
- [x] 7.2 將 `git-handlers.ts` 的內容 inline 到 `git-handler.ts`，刪除 `git-handlers.ts`
- [x] 7.3 更新 `index.ts` export（ProcessHandler 加入 export）
