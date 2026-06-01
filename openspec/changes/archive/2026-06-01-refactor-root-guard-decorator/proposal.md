## Why

`LocalFilesystemService` 目前同時接受 `roots` 和 `rootGuard` 兩個參數，且外部呼叫端需要重複傳入相同的 roots：

```ts
const roots = [claudeProjectsDir];
new LocalFilesystemService(roots, new LocalRootGuard(roots))
```

Root guarding 和 filesystem I/O 是兩個不同的關注點，應該拆開。

## What Changes

- 新增 `RootGuardFilesystem` decorator，實作 `FilesystemService`，在每個方法前攔截路徑驗證
- `LocalFilesystemService` 移除 `roots` 和 `rootGuard` 依賴，成為無狀態的純 I/O 實作
- 刪除 `RootGuard` interface 和 `LocalRootGuard` class（邏輯移入 decorator）
- `browseDirectories(undefined)` / `browseEntries(undefined)` 由 `RootGuardFilesystem` 回傳自己的 roots

## Capabilities

### New Capabilities
- `root-guard-decorator`: `RootGuardFilesystem` wraps any `FilesystemService` and enforces root boundary

### Modified Capabilities
- （無 spec-level 行為變更，只是實作重構）

## Impact

- `packages/filesystem/src/local.ts` — 移除 roots/rootGuard
- `packages/filesystem/src/local-root-guard.ts` — 刪除
- `packages/filesystem/src/root-guard-filesystem.ts` — 新增
- `packages/filesystem/src/index.ts` — 更新 export
- `apps/server/src/scripts/session-scanner.ts` — 更新建構方式
- `packages/test-kit/` 中的 `FakeFilesystemService` — 移除 `setRoots()` 或改為選用
