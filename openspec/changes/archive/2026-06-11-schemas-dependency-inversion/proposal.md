## Why

`packages/schemas` 目前混放了 socket payload schemas 和各 domain service 的 return types（`GitStatusResult`、`FsMutationResult`、`WorktreeInfo` 等），導致 `packages/filesystem` 和 `packages/git` 必須依賴 `@code-quest/schemas` 才能取得自己的 domain types，依賴方向反轉。正確的方向是 schemas 依賴各 domain package，而非反過來。

## What Changes

- 將 `GitStatusResult`、`GitLogResult`、`GitDiffResult`、`GitCommitResult`、`GitAddResult`、`GitPullResult`、`GitPushResult`、`GitFetchResult`、`GitDiscardFileResult`、`WorktreeInfo` 從 `schemas/schemas/git.ts` 搬到 `packages/git/src/types.ts`（純 TypeScript type，不需要 zod schema）
- 將 `FsMutationResult`（及其 zod schema）從 `schemas/schemas/fs.ts` 搬到 `packages/filesystem/src/types.ts`
- `schemas/schemas/git.ts` 和 `schemas/schemas/fs.ts` 改為 re-export from `@code-quest/git` / `@code-quest/filesystem`
- `packages/schemas/package.json` 加入對 `@code-quest/git` 和 `@code-quest/filesystem` 的依賴
- `packages/git` 和 `packages/filesystem` 移除對 `@code-quest/schemas` 的依賴（僅保留 `errMsg` 等 utils 暫時不動）

## Capabilities

### New Capabilities

- `schemas-dependency-inversion`: domain types 歸屬各自的 package，schemas 只做 wire format 的彙整與 re-export

### Modified Capabilities

（無 spec-level 行為變動，純重構）

## Impact

- `packages/git/src/types.ts`：新增 domain result types 定義
- `packages/filesystem/src/types.ts`：新增 FsMutationResult 定義
- `packages/schemas/src/schemas/git.ts`：改為 re-export from `@code-quest/git`
- `packages/schemas/src/schemas/fs.ts`：改為 re-export from `@code-quest/filesystem`
- `packages/schemas/package.json`：新增 `@code-quest/git`、`@code-quest/filesystem` workspace 依賴
- 所有消費者（server、summoner、web、test-kit）的 import 路徑不變（backward-compatible re-export）
