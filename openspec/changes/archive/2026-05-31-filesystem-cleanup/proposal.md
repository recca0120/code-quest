## Why

`/simplify` review 發現三個遺留問題：

1. `TYPES.RawFilesystem` 是 test-only 概念，卻放在 production 的 `apps/server/src/types.ts`
2. 路徑邊界檢查（`resolve + relative + !startsWith('..')`）在三個地方各自實作
3. 測試檔名沒有跟著 class rename 一起更新

## What Changes

- `RootGuardFilesystem.filesystem` 改為 public readonly → test code 可直接存取 inner，移除 `TYPES.RawFilesystem`
- 提取 `isPathWithin(root, path): boolean` helper 到 `packages/filesystem/src/`，`LocalFilesystem.readFile`、`FakeFilesystem.readFile`、`RootGuardFilesystem.isWithin` 共用
- 重命名測試檔：`fake-git-service.test.ts` → `fake-git.test.ts`，`local-git-service.test.ts` → `local-git.test.ts`，其他同理

## Capabilities

### New Capabilities
- （無）

### Modified Capabilities
- （無 spec-level 行為變更，純重構）

## Impact

- `packages/filesystem/src/root-guard-filesystem.ts` — `filesystem` 改 public
- `packages/filesystem/src/` — 新增 `is-path-within.ts`
- `apps/server/src/types.ts` — 移除 `RawFilesystem` token
- `apps/server/src/test/create-test-container.ts` — 改用 public accessor
- `apps/server/src/test/fake-server.ts` — 改用 public accessor
- `packages/test-kit/src/__tests__/` — 重命名測試檔
- `packages/git/src/__tests__/` — 重命名測試檔
- `packages/openspec/src/__tests__/` — 重命名測試檔
- `packages/watch/src/__tests__/` — 重命名測試檔
- `packages/diff-file/src/__tests__/` — 重命名測試檔
