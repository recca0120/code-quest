## Context

已完成的部分（維持不動）：
- `packages/broadcaster/` package 已建立
- `FilesDataSource`、`GitDataSource`、`OpenspecDataSource` 已實作
- Server local / remote 的訂閱流程已通
- 前端 dirty event + snapshot 已串接

本次重構的目標是把三個獨立 `Broadcaster<T>` 合併為一個多型別 `Broadcaster`，解決 remote mode 的 `watch.start` 覆蓋問題。

## Goals / Non-Goals

**Goals:**
- 一個 `Broadcaster` 持有多種 DataSource（files + git + openspec）
- 一次 `subscribe(cwd, subscriberId, cb)` 訂閱全部 type，底層 WatchService 只開一個 watcher per cwd
- remote mode `watch.start` 1:1 對應一個 subscribe，不再有 ref count 問題
- local mode server 只持有一個 `Broadcaster` binding

**Non-Goals:**
- 改變各 DataSource 的過濾邏輯
- 改變前端 dirty event 的 payload 結構

## Decisions

### 新的 Broadcaster API

```ts
type SnapshotCallback = (type: string, data: unknown) => void;

class Broadcaster {
  add(type: string, createSource: (cwd: string) => DataSource<unknown>): this
  subscribe(cwd: string, subscriberId: string, cb: SnapshotCallback): Unsubscribe
}
```

內部結構：

```ts
// per cwd
interface CwdEntry {
  sources: Map<string, { source: DataSource<unknown>; lastValue: unknown | null }>;
  subs: Map<string, SnapshotCallback>;
  unwatches: (() => void)[];
}
```

`add()` 登記一個 type 和它的 createSource factory，在 subscribe 時才懶建立 DataSource。

### subscribe 行為

```
subscribe(cwd, subscriberId, cb)
  → 若 cwd 尚未建立 entry：
      → 對每個已登記的 type，建立 DataSource
      → 每個 DataSource.onChange → read() → 通知所有 subs 的 cb(type, data)
  → 將 cb 加入 subs
  → 對每個 type，若有 lastValue 則立即呼叫 cb(type, lastValue)
    否則發起 read() 並在完成後呼叫 cb(type, data)
  → 回傳 unsubscribe function
    → subs.delete(subscriberId)
    → 若 subs.size === 0：dispose 所有 DataSource，刪除 entry
```

### DataSource abstract class

`DataSource<T>` 改為 abstract class，把 `onChange` + `dispose` 的共用 watch 邏輯內建：

```ts
abstract class DataSource<T> {
  constructor(cwd: string, watchService: WatchService, filter: (path: string) => boolean)
  abstract read(): Promise<T>;
  onChange(cb: () => void): Unsubscribe  // 由 abstract class 實作
  dispose(): void                        // 由 abstract class 實作
}
```

subclass 只需實作 `read()`，並在 constructor 呼叫 `super(cwd, watchService, filter)`。

`watch-callbacks.ts` 的邏輯內化進 abstract class 後刪除。
`matchers.ts` 的 `GIT_META_RE` inline 進各 subclass constructor 後刪除。
`CachedDataSource` 因 `Broadcaster` 本身已有 `hasValue` + `lastValue` cache 而刪除。

### 建立方式（summoner）

```ts
const broadcaster = new LocalBroadcaster()
  .add('files', (cwd) => new FilesDataSource(cwd, watchService, filesystem))
  .add('git', (cwd) => new GitDataSource(cwd, watchService, git))
  .add('openspec', (cwd) => new OpenspecDataSource(cwd, watchService, openspec));
```

一個 `WatchService` instance，三個 DataSource 各自 subscribe 同一個 watcher，底層只開一個 chokidar watcher per cwd。

### AgentHandler 介面

```ts
interface AgentHandler {
  attach(rpc: AgentTransport): void;
  dispose?(): void;
}
```

`attach` 在連線建立時呼叫一次，`dispose` 在連線關閉時由 `Agent.dispose()` 統一委派。

### Agent 簡化為純 orchestrator

```ts
// 之前
constructor(processProvider, filesystem, git, watchService?, openspec?)
this.rpc = rpc; // attach 時儲存，多個 rpc 共用同一個 this.rpc — 有 bug

// 之後
constructor(handlers: AgentHandler[])
attach(rpc: AgentTransport): void { this.handlers.forEach(h => h.attach(rpc)); }
dispose(): void { this.handlers.forEach(h => h.dispose?.()); }
```

Agent 不再持有 `processProvider` 或 `this.rpc`，所有具體邏輯下沉到各 handler。

### ProcessHandler

```ts
class ProcessHandler implements AgentHandler {
  private readonly processProvider: ProcessProvider;
  private readonly spawned = new Map<string, ProcessHandle>();
  private rpc: AgentTransport | null = null;

  attach(rpc: AgentTransport): void {
    this.rpc = rpc;
    rpc.onRequest('process/spawn', ...);
    rpc.onRequest('process/stdin', ...);
    rpc.onRequest('process/kill', ...);
  }

  dispose(): void {
    for (const handle of this.spawned.values()) handle.abort();
    this.spawned.clear();
  }
}
```

`streamProcess` / `streamStderr` 移進 `ProcessHandler`，`emitViaRpc` 變成內部方法使用 `this.rpc`。

### 建立方式（summoner main.ts）

```ts
new Agent([
  new ProcessHandler(processProvider),
  new FsHandler(filesystem),
  new GitHandler(git),
  new BroadcasterHandler(broadcaster),
])
```

### 檔案結構

```
apps/summoner/src/connection/
  agent.ts
  agent-handler.ts
  handlers/
    process-handler.ts
    fs-handler.ts
    git-handler.ts
    broadcaster-handler.ts
  index.ts

packages/broadcaster/src/
  broadcaster.ts          (LocalBroadcaster implements Broadcaster interface)
  types.ts                (Broadcaster interface, BroadcastType, SnapshotCallback, Unsubscribe)
  data-source.ts          (DataSource abstract class)
  data-sources/
    files-data-source.ts
    git-data-source.ts
    openspec-data-source.ts
  index.ts
```

`watch-callbacks.ts`、`matchers.ts`、`cached.ts` 刪除。
資料夾 `datasources/` → `data-sources/`，檔名對齊 class 名稱。

### RemoteBroadcaster 更新

```ts
class RemoteBroadcaster {
  subscribe(cwd: string, subscriberId: string, cb: SnapshotCallback): Unsubscribe {
    // 第一個 subscriber → rpc.request(watch.start, { cwd })
    // snapshot 到來 → cb(type, data)
    // 最後一個 unsubscribe → rpc.request(watch.stop, { cwd })
  }
}
```

介面和 `Broadcaster` 完全對齊（duck typing），server 不需要區分 local / remote。

### Server container

```ts
// 之前：三個分開的 binding
TYPES.FilesBroadcaster
TYPES.GitBroadcaster
TYPES.OpenspecBroadcaster

// 之後：一個
TYPES.Broadcaster
```

Local mode 綁 `Broadcaster` 實例，remote mode 綁 `RemoteBroadcaster` 實例。

### watch.start / watch.stop 協議不變

remote mode 的 RPC 協議本身不改（仍是 `watch.start { cwd }` / `watch.stop { cwd }` / `watch.snapshot { cwd, type, data }`），只是現在 Agent 的 `watch.start` handler 對應一個 `broadcaster.subscribe()`，不會有覆蓋問題。
