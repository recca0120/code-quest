## ADDED Requirements

### Requirement: Git diffStat method
Git interface 新增 `diffStat(cwd: string): Promise<DiffStatResult>` 方法，使用 `git diff --numstat` + `git diff --cached --numstat` 回傳 per-file 及總計的行級統計。

```ts
type DiffStatFile = { file: string; insertions: number; deletions: number };
type DiffStatResult = {
  files: DiffStatFile[];
  totalInsertions: number;
  totalDeletions: number;
};
```

#### Scenario: repo 有變更時回傳 per-file 及總計統計
- **WHEN** working tree 有 modified/added/deleted 檔案
- **THEN** `diffStat(cwd)` 回傳 `files` 陣列（每項含 file/insertions/deletions）及正確的 `totalInsertions` / `totalDeletions` 加總

#### Scenario: unstaged 和 staged 變更合併計算
- **WHEN** 同一檔案同時有 unstaged 和 staged 變更
- **THEN** 該檔案的 insertions/deletions 為兩者之和

#### Scenario: binary 檔案視為 0/0
- **WHEN** numstat 輸出 `-\t-\tfilename`（binary file）
- **THEN** 該檔案 insertions=0, deletions=0

#### Scenario: clean repo 回傳零
- **WHEN** working tree 無任何變更
- **THEN** `diffStat(cwd)` 回傳 `{ files: [], totalInsertions: 0, totalDeletions: 0 }`

### Requirement: statusSummary 回傳 diffstat
`git:statusSummary` RPC response data 新增 optional `insertions` / `deletions` 欄位。

#### Scenario: statusSummary 包含 diffstat
- **WHEN** client 呼叫 `git:statusSummary`
- **THEN** response `data` 包含 `insertions: number` 和 `deletions: number`

### Requirement: DrawerHost 渲染 diffstat badge
DrawerHost header 在 git 類型 drawer 時顯示 diffstat 摘要。

#### Scenario: git drawer 顯示 diffstat
- **WHEN** drawer 開啟且 `content.type === 'git'` 且 insertions + deletions > 0
- **THEN** header 渲染 `+N / -N` 文字（font-mono text-2xs）

#### Scenario: 無變更時不顯示 diffstat
- **WHEN** drawer 開啟且 `content.type === 'git'` 且 insertions + deletions === 0
- **THEN** 不渲染 diffstat 文字

#### Scenario: 非 git drawer 不顯示 diffstat
- **WHEN** drawer 開啟且 `content.type !== 'git'`
- **THEN** 不渲染 diffstat 文字
