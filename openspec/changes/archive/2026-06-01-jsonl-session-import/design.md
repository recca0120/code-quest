## Context

Claude CLI stores every conversation in `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`. The encoding replaces `/` with `-` (e.g. `/Users/foo/bar` → `-Users-foo-bar`). Each JSONL line is a JSON object with a `type` field.

**Key constraint**: JSONL files live on the machine where `summoner` runs. In remote mode, `server` and `summoner` are on different machines — `server` cannot read local files directly. All JSONL I/O must go through `summoner`, and results are communicated to `server` via the existing WS protocol.

Some JSONL entry types (`ai-title`, `attachment`, `file-history-snapshot`, `queue-operation`, `last-prompt`) are written by the CLI directly to the JSONL file — never emitted to stdout, never captured by `RawRecorder`. They are unique to the JSONL format.

## Goals / Non-Goals

**Goals:**
- External sessions appear in `session.list` with full history replay (import)
- App-created sessions exported to JSONL so `claude --resume` and other tools can see them (export)
- `JsonlReader`/`JsonlWriter` are pure functions testable without I/O
- Works in both local and remote summoner mode
- Interactive CLI tool to browse and import sessions with status indication

**Non-Goals:**
- Continuous fs.watch after initial import (first milestone only)
- `agent-*.jsonl` subagent files
- Resume of imported sessions (separate concern)
- Attaching to running external sessions interactively (`--session-id` without `-p` errors "already in use")

## Decisions

### 1. `packages/jsonl-codec/` — Source / Sink 架構 + Project Scanner

**Decision**: 以 `SessionSource` / `SessionSink` 兩個 interface 為核心。Project / session listing 屬於 JSONL 格式知識，放在 `jsonl-codec`，透過 `Filesystem`（`packages/filesystem`）注入，讓測試可用 fake fs。

`JsonlProjectScanner` 新增 `fileExists(absolutePath)` — 讓 `SessionScanner` 透過已注入的 fs 判斷 JSONL 是否存在，不直接碰 `fs.stat()`。

```
packages/jsonl-codec/
  SessionData        ← { events: RawEvent[], record: JsonlSessionRecord }
  SessionSource      ← interface { read(sessionId): Promise<SessionData> }
  SessionSink        ← interface { write(sessionId, data): Promise<void> }

  JsonlFileReader implements SessionSource  ← constructor(jsonlPath)，用 JsonlDecoder 讀 JSONL 檔
  JsonlFileWriter implements SessionSink    ← constructor(outputPath)，用 JsonlEncoder 寫 JSONL 檔，注入 sessionId + cwd
  MemoryReader implements SessionSource ← constructor(Map<sessionId, SessionData>)，for testing
  MemoryWriter implements SessionSink   ← .data: Map<sessionId, SessionData> 供 assertion，for testing

  JsonlProjectScanner ← constructor(fs: FilesystemService, claudeProjectsDir: string)
    scanProjects() → ProjectInfo[]   ← 掃描 ~/.claude/projects/ 目錄結構
    scanSessions(projectPath) → JsonlSession[]  ← 讀各 .jsonl 的 header meta

  JsonlDecoder  ← 純轉換，JSONL lines → RawEvent[]
  JsonlEncoder  ← 純轉換，RawEvent → JSONL line（internal only）

packages/filesystem/
  FilesystemService interface  ← 已有，LocalFilesystemService 為真實實作
  test-kit 提供 FakeFilesystemService ← 測試用

apps/server/
  DbReader implements SessionSource  ← rawEventService + sessionStore → SessionData
  DbWriter implements SessionSink    ← SessionData → rawEventService + sessionStore
  importSession(jsonlPath, ...) ← JsonlFileReader + DbWriter 的組合（module-level，在 session-manager.ts）
  exportSession(sessionId, outputPath, ...) ← DbReader + JsonlFileWriter 的組合（同上）
  SessionScanner ← constructor 接受注入的 JsonlProjectScanner + DB services，提供 import/export 狀態判斷
  SessionManager ← class，封裝 TUI 互動邏輯（run/runImport/runExport）
```

**Why**: Project/session listing 只依賴 JSONL 格式知識和 filesystem，與 DB 無關，屬於 codec 層。注入 `FilesystemService` 讓測試完全不碰真實 fs。`SessionScanner`（server 層）負責需要 DB 的部分（import 狀態、export 狀態）。

### 2. 架構：Summoner 負責所有 JSONL I/O

```
Server (DB)                      Summoner (本機檔案系統)
    │                                    │
    │── jsonl:import_request ���─────────▶ │ 掃描 ~/.claude/projects/
    │                                    │ 讀 JSONL → JsonlReader
    │◀─ jsonl:import_data (batched) ──── │ ��� raw_events + SessionRecord
    │ 寫進 DB                            │
    │                                    │
    │── jsonl:export_request ──────────▶ │
    │── jsonl:export_data (raw_events) ─▶│ JsonlWriter → 寫 JSONL 檔
```

### 3. Import: dir 對應規則

| JSONL type | raw_event dir | 原因 |
|------------|--------------|------|
| `user` | `out` | JSONL user 與 stdout echo 格式一致（50 筆，非 stdin 的 5 筆）|
| 其他所有 type | `out` | 對應 stdout |
| `isSidechain: true` | skip | 父 session 的 context 快照 |

JSONL-only types（`ai-title`、`attachment` 等）全部存進去，不過濾。

**`hasUserEcho` 自動處理**: user 存成 `dir: 'out'`，`hasUserEcho = true`，`filterReplayEvents` 只保留 `out`，`replayStdoutEvent` → `transformUser` 正確處理。不需要特判。

### 4. Export: raw_event → JSONL 對應規則

| raw_event dir + type | JSONL 輸出 |
|---------------------|-----------|
| `in`, `type: "user"` | `type: "user"` entry |
| `out`, `type: "assistant"/"system"/"result"` | 對應 JSONL entry |
| `out`, `type: "stream_event"` | skip |
| `in/out`, `type: "control_request/response"` | skip |
| `out`, `type: "user"` (stdout echo) | skip（避免重複） |

### 5. Skip guard（Import）

Import 前 server 檢查 `rawEventService.getBySession(sessionId)`，有資料則跳過。避免重複 import live session。

### 6. Startup scan（fs.watch 暫不實作）

Server start 時發 `jsonl:import_request` 給 summoner，summoner 掃描所有 `*.jsonl`（排除 `agent-*.jsonl`），分批回傳。背景執行，不 block server ready。

### 7. Session import 狀態判斷

三種狀態，分兩層判斷：

| 狀態 | 判斷條件 | 判斷時機 |
|------|---------|---------|
| `NOT IMPORTED` | sessionId 不在 `sessions` table | Project 層（快速） |
| `IMPORTED` | sessionId 在 `sessions` table，且 DB raw_events ≥ JSONL producible × 0.95 | Session 層（點進後） |
| `PARTIAL` | sessionId 在 `sessions` table，但 DB raw_events < JSONL producible × 0.95 | Session 層（點進後） |

**JSONL producible count** = non-sidechain、可 parse 的行數（`JsonlReader.readLine` 不回傳 null 的）。

### 8. Session Manager CLI

互動式 TUI，使用 `@inquirer/prompts` + `chalk`（顏色）：

```
── Session Manager ──

? What do you want to do?
❯ Import  JSONL → DB  (35 sessions available)
  Export  DB → JSONL  (12 sessions not yet exported)
  ──────────────────
  Exit

[Import mode]
? Select a project
❯ /cc-office   39 sessions · 35 not imported     ← yellow
  /DQ          10 sessions · all imported         ← gray

? /cc-office — select sessions to import
  ◼ ○ NOT IMPORTED  2026-05-31  "Discuss session visibility..."  ← white
  ◼ ~ PARTIAL       2026-05-18  "Broadcaster datasource..."      ← yellow
  ◻ ✓ IMPORTED      2026-05-14  "Analyze Claude Agent SDK..."    ← gray (disabled)

[Export mode]
? Select a project
❯ /cc-office   8 exportable
  /DQ          4 exportable

? /cc-office — select sessions to export
  ◼ ○ NOT EXPORTED  2026-05-31  1cec192e  "Discuss session visibility..."
  ◻ ✓ EXPORTED      2026-05-14  b3dbab57  "Analyze Claude Agent SDK..."  (disabled)
```

**Export 狀態判斷**：
- `NOT EXPORTED`：sessionId 在 DB `sessions` table，但 `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` 不存在
- `EXPORTED`：JSONL 檔案已存在

選擇後批次呼叫 `importSession(jsonlPath, rawEventService, sessionStore)` 或 `exportSession(sessionId, outputPath, rawEventService, sessionStore)`。

### 9. 驗證用 session

Session `b3dbab57-8da8-40c9-86e8-11aadc1881e8`（cwd: `/Users/recca0120/WebstormProjects/cc-office`）：
- MySQL：`dir='out' type='assistant'` 64 筆
- JSONL：`assistant` 64 筆

TDD 測試用此 session 的 JSONL 作為 fixture，驗證 `JsonlReader` 輸出的 assistant raw_events 與 MySQL 對應行完全一致。

## Risks / Trade-offs

- **JSONL format drift** → 未知 type 全部存進去，adapter 走 `raw:event`，不 crash。
- **Large JSONL files** → 逐行讀，分批送，不整個載入記憶體。
- **Export 覆蓋問題** → Export 寫到 `~/.claude/projects/<cwd>/<sessionId>.jsonl`；若檔案已存在則 append，不覆蓋。
- **Import on startup 變慢** → 背景執行，不 block server ready。

## Migration Plan

No schema changes. Import runs on server start. Export triggered on session end. Existing sessions unaffected.
