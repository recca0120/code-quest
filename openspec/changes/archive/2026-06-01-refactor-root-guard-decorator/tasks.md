## 1. 新增 RootGuardFilesystem decorator

- [x] 1.1 建立 `packages/filesystem/src/root-guard-filesystem.ts`，實作 `FilesystemService`，注入 `inner` + `roots`
- [x] 1.2 TDD：`browseDirectories(undefined)` / `browseEntries(undefined)` 回 roots 列表
- [x] 1.3 TDD：有 path 時先驗證邊界，通過才呼叫 inner；超界拋 `PathOutsideRootsError`
- [x] 1.4 移植 `LocalRootGuard` 的 `isStructurallyWithinRoots` / `isWithinRoots` 邏輯為 private 方法

## 2. 簡化 LocalFilesystemService

- [x] 2.1 移除 `roots`、`rootGuard` 參數，constructor 只保留 `logger?` / `fsImpl?`
- [x] 2.2 移除所有 `guardPath()` 呼叫，方法直接操作路徑
- [x] 2.3 `browseDirectories(undefined)` / `browseEntries(undefined)` 回空陣列（由 decorator 處理）
- [x] 2.4 更新 `packages/filesystem/src/__tests__/local.test.ts`

## 3. 刪除 RootGuard

- [x] 3.1 刪除 `packages/filesystem/src/local-root-guard.ts`
- [x] 3.2 刪除 `packages/filesystem/src/__tests__/local-root-guard.test.ts`
- [x] 3.3 從 `types.ts` 移除 `RootGuard` interface
- [x] 3.4 更新 `packages/filesystem/src/index.ts` export

## 4. 更新 FakeFilesystemService

- [x] 4.1 移除 `packages/test-kit` 中 `FakeFilesystemService` 的 `setRoots()` 方法
- [x] 4.2 更新相關測試（`project-scanner.test.ts` 等移除 `fs.setRoots([...])` 呼叫）

## 5. 更新呼叫端

- [x] 5.1 `apps/server/src/scripts/session-scanner.ts`：改用 `new RootGuardFilesystem(new LocalFilesystemService(), [roots])`
- [x] 5.2 搜尋全專案其他 `LocalRootGuard` / `LocalFilesystemService(roots,` 用法一併更新

## 6. 驗證

- [x] 6.1 跑 `pnpm test` 全部通過
- [x] 6.2 跑 `pnpm knip` 無 unused export
