## Context

`packages/filesystem` 提供 `FilesystemService` interface。目前唯一的本地實作 `LocalFilesystemService` 同時負責 I/O 和路徑安全邊界驗證，後者透過注入的 `RootGuard` 完成。呼叫端需要同時構造 `LocalRootGuard(roots)` 和 `LocalFilesystemService(roots, guard)`，roots 重複傳入。

## Goals / Non-Goals

**Goals:**
- `LocalFilesystemService` 成為純 I/O 實作，無 roots/guard 依賴
- Root 驗證邏輯集中在 `RootGuardFilesystem` decorator
- 刪除 `RootGuard` interface 和 `LocalRootGuard` class
- `FakeFilesystemService` 不再需要 `setRoots()`

**Non-Goals:**
- 不改變 `FilesystemService` interface 定義
- 不改變 `RemoteFilesystemService`

## Decisions

### RootGuardFilesystem 是 Decorator

```ts
class RootGuardFilesystem implements FilesystemService {
  constructor(
    private readonly inner: FilesystemService,
    private readonly roots: readonly string[],
  ) {}

  // browseDirectories(undefined) → 回 roots 列表，不呼叫 inner
  // browseDirectories(path)      → 驗證 → inner.browseDirectories(path)
  // 所有其他方法                 → 驗證 → inner.xxx(...)
}
```

### 路徑驗證邏輯內化

`LocalRootGuard` 的 `isStructurallyWithinRoots` / `isWithinRoots` 邏輯直接移入 `RootGuardFilesystem` 的 private 方法，不再需要 `RootGuard` interface。

### LocalFilesystemService constructor 簡化

```ts
// Before
constructor(roots, rootGuard, logger?, fsImpl?)

// After
constructor(logger?: MinimalLogger, fsImpl?: ...)
```

### FakeFilesystemService 移除 setRoots()

目前 `FakeFilesystemService.setRoots()` 只是為了讓路徑驗證通過。移除後，測試如需邊界驗證可包一層 `RootGuardFilesystem(fake, [roots])`，但大多數測試不需要。

### 呼叫端用法

```ts
// Before
const roots = [claudeProjectsDir];
new LocalFilesystemService(roots, new LocalRootGuard(roots))

// After
new RootGuardFilesystem(new LocalFilesystemService(), [claudeProjectsDir])
```

## Risks / Trade-offs

- `browseDirectories(undefined)` 語義由 decorator 處理，`LocalFilesystemService` 需要決定無 path 時的行為（拋錯或回空）
- `RootGuard` interface 刪除後，若有外部套件引用需一起更新（目前只有 `local.ts` 使用）
