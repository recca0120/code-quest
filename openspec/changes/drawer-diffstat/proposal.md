## Why

Design spec (handoff §5) 要求 DrawerHost header 在顯示 git 類型內容時，渲染 diffstat 摘要（`+N / -N lines`），讓使用者快速掌握變更規模。目前 `git:statusSummary` 只回傳 `changedFilesCount`，缺少行級 insertions/deletions 資訊。

## What Changes

- 新增 `Git.diffStat(cwd)` 方法，回傳 `{ insertions: number; deletions: number }`
- 擴充 `worktreeStatusResponseSchema` 的 data 加上 optional `insertions` / `deletions`
- Server `handleStatusSummary` 額外呼叫 `git diff --shortstat` 並回傳行級統計
- Client `GitContext` 暴露 diffstat 資料（隨 statusSummary 一起取得）
- DrawerHost header 當 `content.type === 'git'` 時渲染 `+N / -N` 徽章

## Capabilities

### New Capabilities
- `git-diffstat`: 提供 git diff 行級統計（insertions/deletions）並在 DrawerHost header 渲染

### Modified Capabilities

## Impact

- `packages/git/src/types.ts` — Git interface 新增 `diffStat` method
- `packages/git/src/commands.ts` — 實作 `diffStat`（`git diff --shortstat` parse）
- `packages/test-kit/src/fake-git.ts` — FakeGit 新增 `diffStat` stub
- `packages/schemas/src/socket/worktree.ts` — response schema 擴充
- `apps/server/src/socket/handlers/git.ts` — `handleStatusSummary` 加入 diffStat
- `apps/web/src/contexts/GitContext.tsx` — 暴露 insertions/deletions
- `apps/web/src/components/workspace/DrawerHost.tsx` — 渲染 diffstat badge
