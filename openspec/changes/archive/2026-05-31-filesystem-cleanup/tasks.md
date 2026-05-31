## 1. 提取 isPathWithin helper

- [x] 1.1 建立 `packages/filesystem/src/is-path-within.ts`，export `isPathWithin(root: string, path: string): boolean`
- [x] 1.2 TDD：root itself、nested path、prefix-sibling、`../` traversal
- [x] 1.3 `RootGuardFilesystem.isWithin` 改用 `isPathWithin`（loop over roots）
- [x] 1.4 `LocalFilesystem.readFile` 改用 `isPathWithin`
- [x] 1.5 `FakeFilesystem.readFile` 改用 `isPathWithin`
- [x] 1.6 export from `packages/filesystem/src/index.ts`

## 2. 移除 TYPES.RawFilesystem

- [x] 2.1 `RootGuardFilesystem.filesystem` 改為 `readonly filesystem: Filesystem`（public）
- [x] 2.2 `apps/server/src/test/create-test-container.ts`：移除 `TYPES.RawFilesystem` binding，改用 cast + `.filesystem`
- [x] 2.3 `apps/server/src/test/fake-server.ts`：移除 `isBound(TYPES.RawFilesystem)` 條件，直接 cast
- [x] 2.4 `apps/server/src/types.ts`：移除 `RawFilesystem` token

## 3. 重命名測試檔

- [x] 3.1 `fake-git-service.test.ts` → `fake-git.test.ts`
- [x] 3.2 `fake-watch-service.test.ts` → `fake-watch.test.ts`
- [x] 3.3 `local-git-service.test.ts` → `local-git.test.ts`
- [x] 3.4 `local-openspec-service.test.ts` → `local-openspec.test.ts`
- [x] 3.5 `local-watch-service.test.ts` → `local-watch.test.ts`
- [x] 3.6 `diff-file/src/__tests__/local.test.ts` → `local-diff-file.test.ts`
- [x] 3.7 更新各測試檔內對應 import 路徑

## 4. 驗證

- [x] 4.1 `pnpm test` 全部通過
- [x] 4.2 `pnpm --filter @code-quest/server exec tsc --noEmit` 無錯誤
