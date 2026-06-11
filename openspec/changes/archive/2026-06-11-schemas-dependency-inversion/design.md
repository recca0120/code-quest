## Context

`packages/schemas` 目前同時扮演兩個角色：
1. **Wire format schemas**：socket event payload 的 zod 定義（如 `messageSchema`、`sessionSchema`）
2. **Domain types**：各 service 的 return types（`GitStatusResult`、`FsMutationResult` 等）

這導致 `packages/git` 和 `packages/filesystem` 必須依賴 `@code-quest/schemas` 才能取得自己方法的 return type，形成反向依賴。目前已完成 `GitService` interface 和 `WatchService` interface 的搬移（schemas re-export from `@code-quest/git`/`@code-quest/watch`），但 domain result types（`GitStatusResult`、`FsMutationResult` 等）仍住在 schemas。

## Goals / Non-Goals

**Goals:**
- `packages/git` 和 `packages/filesystem` 完全擁有自己的 domain types
- `packages/schemas` 只作為 wire format 的彙整層，對 domain types 做 re-export
- 所有現有 consumer（server、summoner、web、test-kit）的 import 路徑不變

**Non-Goals:**
- 搬移 `errMsg`、`isRecord` 等 utils（留到下一個 change 討論）
- 搬移 `ProcessProvider`（循環依賴，留在 schemas 作為 shared contract）
- 更動 socket event payload schemas（只動 domain types 的位置）

## Decisions

**決策 1：domain types 改為純 TypeScript type（不帶 zod schema）**

`GitStatusResult` 等型別在 schemas 裡是 `z.infer<typeof gitStatusResultSchema>` 取出的，但這些 zod schema 物件本身沒有被任何地方用來 parse。搬到 git package 後直接定義為 TypeScript interface/type，不需要帶 zod 依賴。

備選：把 zod schema 一起搬過去。但 git package 目前沒有 zod 依賴，引入只為了 `z.infer<>` 沒有意義。

**決策 2：schemas 改為 re-export，不刪除 export 路徑**

`schemas/schemas/git.ts` 和 `schemas/schemas/fs.ts` 改為 `export type { ... } from '@code-quest/git'` / `from '@code-quest/filesystem'`，保持 backward-compatible。不需要修改任何 consumer 的 import。

**決策 3：git package 的型別放在 `src/types.ts`**

`GitService`、`CreateWorktreeOptions` 已搬到 `packages/git/src/types.ts`，domain result types 也一起放在這裡。統一入口，不散落多個檔案。

## Risks / Trade-offs

- **型別循環（type-only）**：`schemas → git → schemas` 可能形成 type-only 循環。`git` 的 `GitService` interface 引用 `GitStatusResult` 等，都住在 git 自己，不再需要 import from schemas。此循環消除。
- **zod schema 和 TypeScript type 不同步**：`schemas/schemas/git.ts` 裡的 zod schema 驗證形狀和 git package 的 TypeScript type 必須保持一致，但沒有編譯期保證。風險低（這些型別很穩定），日後可用 `z.infer` import from git 來消除不一致。

## Migration Plan

1. 將 result types 搬到 git/filesystem package（純 TypeScript，無 zod）
2. schemas 的 `git.ts`/`fs.ts` 改為 re-export（`export type { ... } from '@code-quest/git'`）
3. `packages/schemas/package.json` 加入 `@code-quest/git`、`@code-quest/filesystem`
4. git/filesystem 內部的 import 路徑更新（從 schemas import → 從 self import）
5. 跑全套測試確認 backward compatibility
