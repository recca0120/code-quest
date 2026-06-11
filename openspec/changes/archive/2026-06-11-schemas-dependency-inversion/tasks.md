## 1. Git domain result types 搬到 packages/git

- [x] 1.1 在 `packages/git/src/types.ts` 新增 `GitFileChange`、`GitLogEntry` TypeScript type 定義（對應 schemas/schemas/git.ts 的 zod infer 結果）
- [x] 1.2 在 `packages/git/src/types.ts` 新增 `GitStatusResult`、`GitLogResult`、`GitDiffResult` TypeScript type 定義
- [x] 1.3 在 `packages/git/src/types.ts` 新增 `GitAddResult`、`GitCommitResult`、`GitPushResult`、`GitFetchResult`、`GitPullResult`、`GitDiscardFileResult` TypeScript type 定義
- [x] 1.4 在 `packages/git/src/index.ts` export 以上所有新增的 types
- [x] 1.5 `packages/schemas/src/schemas/git.ts` 將對應 type alias 改為 `export type { ... } from '@code-quest/git'`（保留 zod schema const，只替換 type alias）
- [x] 1.6 `packages/schemas/package.json` 加入 `"@code-quest/git": "workspace:*"` 依賴（若尚未存在）
- [x] 1.7 確認 `packages/git` 內部所有 import（`commands.ts` 等）改為從自己的 `./types.ts` 取得這些型別，不再 import from `@code-quest/schemas`

## 2. WorktreeInfo 搬到 packages/git

- [x] 2.1 在 `packages/git/src/types.ts` 新增 `WorktreeInfo` TypeScript type 定義（對應 schemas/schemas/worktree.ts 的 zod infer 結果）
- [x] 2.2 在 `packages/git/src/index.ts` export `WorktreeInfo`
- [x] 2.3 `packages/schemas/src/schemas/worktree.ts` 將 `WorktreeInfo` type alias 改為 `export type { WorktreeInfo } from '@code-quest/git'`（保留 zod schema）
- [x] 2.4 `packages/git/src/worktree.ts` 改為從 `./types.ts` 取得 `WorktreeInfo`（不再 from `@code-quest/schemas`）

## 3. FsMutationResult 搬到 packages/filesystem

- [x] 3.1 在 `packages/filesystem/src/types.ts` 新增 `FsMutationResult` TypeScript type 定義（`{ ok: true } | { error: string }`）
- [x] 3.2 在 `packages/filesystem/src/index.ts` export `FsMutationResult`
- [x] 3.3 `packages/schemas/src/schemas/fs.ts` 將 `FsMutationResult` type alias 改為 `export type { FsMutationResult } from '@code-quest/filesystem'`（保留 `fsMutationResultSchema` zod const）
- [x] 3.4 `packages/schemas/package.json` 加入 `"@code-quest/filesystem": "workspace:*"` 依賴（若尚未存在）
- [x] 3.5 `packages/filesystem/src/local.ts` 的 `FsMutationResult` import 改為從 `./types.ts` 取得（不再 from `@code-quest/schemas`）

## 4. 全套測試驗證

- [x] 4.1 跑 `pnpm --filter @code-quest/git test` 確認通過
- [x] 4.2 跑 `pnpm --filter @code-quest/filesystem test` 確認通過
- [x] 4.3 跑 `pnpm --filter @code-quest/schemas test` 確認通過（若有測試）
- [x] 4.4 跑 `pnpm test` 全套確認 backward compatibility 無破壞
