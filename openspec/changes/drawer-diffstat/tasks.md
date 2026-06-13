# Tasks: drawer-diffstat

務必用 TDD（先改測試 RED → 改 code GREEN）。跨 package 依賴順序：git → schemas → server → web。

## 1. Git package — diffStat method

- [x] 1.1 **git-interface**: `packages/git/src/types.ts` Git interface 新增 `diffStat(cwd: string): Promise<{ insertions: number; deletions: number }>`
- [x] 1.2 **git-commands**: `packages/git/src/commands.ts` GitCommands 實作 `diffStat`——執行 `git diff --numstat` + `git diff --cached --numstat`，parse per-file insertions/deletions 並加總
- [x] 1.3 **local-git**: `packages/git/src/local-git.ts` LocalGit 代理 `diffStat` 到 GitCommands
- [x] 1.4 **remote-git**: `packages/git/src/remote-git.ts` RemoteGit 實作 `diffStat`（透過 RPC）
- [x] 1.5 **fake-git**: `packages/test-kit/src/fake-git.ts` FakeGit 新增 `diffStat` stub + setter（`setDiffStat`）

## 2. Schema — worktreeStatusResponse 擴充

- [x] 2.1 **schema-extend**: `packages/schemas/src/socket/worktree.ts` worktreeStatusResponseSchema data 加 optional `insertions: z.number().int().nonnegative().optional()` / `deletions: z.number().int().nonnegative().optional()`

## 3. Server — handleStatusSummary 加入 diffStat

- [x] 3.1 **handler-extend**: `apps/server/src/socket/handlers/git.ts` handleStatusSummary 呼叫 `gitService.diffStat(cwd)` 並將 insertions/deletions 加到 callback data

## 4. Client — GitContext 暴露 diffstat

- [x] 4.1 **context-extend**: `apps/web/src/contexts/GitContext.tsx` statusSummary callback 處理 optional insertions/deletions，存入 state 並透過 context 暴露

## 5. UI — DrawerHost header 渲染 diffstat

- [x] 5.1 **drawer-diffstat-render**: `apps/web/src/components/workspace/DrawerHost.tsx` 當 `content.type === 'git'` 且 insertions+deletions > 0 時在 header 渲染 `+N / -N`（font-mono text-2xs）；測試驗 diffstat 文字渲染與不渲染條件
