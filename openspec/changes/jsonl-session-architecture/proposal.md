## Why

`SessionScanner` 原本直接依賴 `RawEventService`、`SessionStore`、`JsonlProjectScanner`，混合了不同層次的具體實作。`importSession`/`exportSession` 的職責也放錯位置。

重構目標：讓每個物件只依賴它真正需要的抽象，filesystem 與 DB 兩側完全對稱，命名反映職責而非實作細節。

## What Changed

**抽象層（`@code-quest/session-store`）**

- `ProjectScanner` interface — 列出 sessions、查詢是否存在、計算 event 數
- `Transfer` class — 封裝 reader → writer 的搬移操作（原 `Converter`）
- `FileReader` / `FileWriter` abstract class — 基於 `Filesystem` 的 template method
- `FileProjectScanner` abstract class — 基於 `Filesystem` 的 project scan template method
- `JsonlFileReader` / `JsonlFileWriter` — JSONL 格式的具體實作
- `JsonlProjectScanner` — JSONL 格式的 project scanner
- `MemoryReader` / `MemoryWriter` — 測試用 in-memory 實作

**Server 層（`@code-quest/server`）**

- `DbProjectScanner implements ProjectScanner`（原 `DbProjectList`）
- `DbSessionReader` / `DbSessionWriter` — DB 側 reader/writer
- `SessionMigrator`（原 `SessionScanner`）— 消費兩個 `ProjectScanner`，產出 import/export 狀態
- `SessionManager` — 持有 `SessionMigrator`、reader、writer、filesystem，執行 import/export

**命名原則**

- 參數/欄位名移除實作細節（`jsonlPath` → `filePath`、`JsonlSessionRecord` → `SessionRecord`、`jsonlProjects/dbProjects` → `source/target`）
- 目錄結構依職責分層：`reader/`、`writer/`、`scanner/`、`jsonl/`

## Capabilities

- `session-reader-writer`: `SessionReader`/`SessionWriter` interfaces + abstract + JSONL concrete + memory
- `project-scanner`: `ProjectScanner` interface + abstract + JSONL concrete + DB concrete
- `session-migrator`: 跨兩個 `ProjectScanner` 的 import/export 狀態比對
- `session-manager`: import/export 操作的 CLI entry point
