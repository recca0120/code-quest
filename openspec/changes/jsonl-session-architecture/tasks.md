## Tasks

### session-store — 核心抽象與實作

- [x] `ProjectScanner` interface（原 `ProjectList`）
- [x] `Transfer` class（原 `Converter`），`run()` 取代 `convert()`
- [x] `FileReader` abstract class，implements `SessionReader`
- [x] `FileWriter` abstract class，implements `SessionWriter`
- [x] `JsonlFileReader` extends `FileReader`
- [x] `JsonlFileWriter` extends `FileWriter`
- [x] `MemoryReader` / `MemoryWriter`（拆自 `memory.ts`）
- [x] `FileProjectScanner` abstract class，implements `ProjectScanner`
- [x] `JsonlProjectScanner` extends `FileProjectScanner`
- [x] 目錄結構：`reader/`、`writer/`、`scanner/`、`jsonl/`
- [x] `SessionRecord`（原 `JsonlSessionRecord`），`filePath`（原 `jsonlPath`）

### server — DB 實作

- [x] `DbProjectScanner implements ProjectScanner`（原 `DbProjectList`）
- [x] `DbSessionReader` / `DbSessionWriter`
- [x] `RawEventRepository.appendBatch()` + `RawEventStore.appendEvents()`
- [x] `DbSessionWriter` 改用 `appendBatch`（sequential inserts）

### server — SessionMigrator / SessionManager

- [x] `SessionMigrator`（原 `SessionScanner`），constructor `(source, target: ProjectScanner)`
- [x] `scanExportable()` 改為一次 `source.scanProjects()` 取代 N 次 `hasSession`
- [x] `SessionManager`：持有 reader、writer、filesystem、scanner
- [x] import/export 共用 `guardedFs`（`RootGuardFilesystem`）

### 收尾

- [x] 移除所有 `vi.fn()` mock，改用 `MemoryReader/Writer`、`StubProjectScanner`、in-memory DB
- [x] 移除 `decodeProjectDir`/`encodeProjectDir` 的 public export（無外部 consumer）
- [x] 全部測試通過
