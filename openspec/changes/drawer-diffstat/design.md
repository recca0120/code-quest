## Context

DrawerHost 在顯示 git 內容時需要在 header 渲染行級 diffstat（`+N / -N`）。目前 `git:statusSummary` RPC 只回傳 branch / isClean / changedFilesCount。需要新增 `diffStat` 能力取得 insertions/deletions。

Client 端已有 `parseUnifiedDiff`（`apps/web/src/utils/parse-unified-diff.ts`）可從 unified diff 文字算出 per-file `added` / `removed`，但那只在使用者點開 DiffDrawer 時才執行。GitView file list 目前無法顯示 per-file 行數——需要 server 側提供。

## Goals / Non-Goals

**Goals:**
- Git interface 新增 `diffStat(cwd)` 方法，回傳 per-file + 總計 insertions/deletions
- `handleStatusSummary` 回傳 optional totalInsertions/totalDeletions + per-file stats（向後相容）
- Client GitContext 暴露 diffstat 隨 statusSummary 一起更新
- DrawerHost header 渲染 `+N / -N` 總計文字

**Non-Goals:**
- 不新增獨立 socket event（piggyback 在 statusSummary 上）
- 不改 `git:statusByCwd` event（那是完整 status 用途不同）
- GitView file list 顯示 per-file stat 留後續 change（本次只做 DrawerHost header 總計）

## Decisions

1. **使用 `git diff --numstat`（非 `--shortstat`）** — numstat 回傳 per-file `insertions\tdeletions\tfilename`，可自行加總得到 repo-level 數字。比 shortstat 多拿 per-file 粒度，未來 GitView file list 要顯示 per-file stat 時不用再加新 RPC。
2. **回傳格式** — `Git.diffStat(cwd)` 回傳：
   ```ts
   {
     files: Array<{ file: string; insertions: number; deletions: number }>;
     totalInsertions: number;
     totalDeletions: number;
   }
   ```
3. **Piggyback on statusSummary** — response data 新增 optional `insertions?: number` / `deletions?: number`（總計）。per-file 暫不透過 statusSummary 回傳（避免 payload 過大），留給 `git:statusByCwd` 擴充或獨立 event。
4. **FakeGit stub** — `FakeGit.diffStat()` 預設回傳 `{ files: [], totalInsertions: 0, totalDeletions: 0 }`，提供 `setDiffStat` setter 讓測試 prime 資料。
5. **Client 端不新建 hook** — diffstat 直接從 GitContext 的 statusSummary data 取得（`insertions` / `deletions` 欄位）。DrawerHost 直接讀 context。
6. **UI 渲染** — DrawerHost header title 右側加 `<span className="font-mono text-2xs">+{insertions} / -{deletions}</span>`，僅在 `content.type === 'git'` 且 insertions+deletions > 0 時顯示。
7. **numstat parse** — `git diff --numstat` 對 binary file 輸出 `-\t-\tfilename`，parse 時視為 0/0。也需要 `git diff --cached --numstat` 才能涵蓋 staged 變更——兩者合併（同檔合算）。

## Risks / Trade-offs

- `git diff --numstat` 在大 repo 可能慢（幾百 ms）—— 可接受，因為 statusSummary 本身已在背景呼叫且非 blocking。
- 同一檔案在 unstaged + staged 都有改動時需合併——parse 階段以 filename 為 key 加總。
- Optional fields 確保向後相容：舊 server 不回傳時 client 不 crash。
- per-file stat 暫不透過 statusSummary 傳——未來如果 GitView file list 要用，可擴充 `git:statusByCwd` response 或加新 event。
