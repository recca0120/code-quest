## Architecture

### 完整依賴圖

```
┌─────────────────────────────────────────────────────────┐
│               @code-quest/session-store                 │
│                                                         │
│  types.ts                                               │
│    SessionReader / SessionWriter / SessionData          │
│    ProjectScanner / ProjectSummary / SessionSummary     │
│    SessionRecord                                        │
│                                                         │
│  reader/                                                │
│    FileReader (abstract)  implements SessionReader      │
│      └── Filesystem                                     │
│    JsonlFileReader extends FileReader                   │
│    MemoryReader   implements SessionReader              │
│                                                         │
│  writer/                                                │
│    FileWriter (abstract)  implements SessionWriter      │
│      └── Filesystem                                     │
│    JsonlFileWriter extends FileWriter                   │
│    MemoryWriter   implements SessionWriter              │
│                                                         │
│  scanner/                                               │
│    FileProjectScanner (abstract) implements ProjectScanner │
│      └── Filesystem                                     │
│    JsonlProjectScanner extends FileProjectScanner       │
│                                                         │
│  jsonl/                                                 │
│    decoder.ts  (parseLine, parseLines, decodeSession)   │
│    encoder.ts  (encodeEvent)                            │
│                                                         │
│  Transfer(reader: SessionReader, writer: SessionWriter) │
│    run(sessionId): Promise<void>                        │
│                                                         │
│  SessionMigrator(source: ProjectScanner, target: ProjectScanner) │
│    scanProjects(): Promise<ProjectInfo[]>               │
│    resolveImportStatuses(): Promise<ImportStatusEntry[]>│
│    scanExportable(): Promise<ExportableProject[]>       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   @code-quest/server                    │
│                                                         │
│  DbSessionReader  implements SessionReader              │
│    ├── RawEventStore                                    │
│    └── SessionStore                                     │
│                                                         │
│  DbSessionWriter  implements SessionWriter              │
│    ├── RawEventStore  (appendBatch — sequential inserts)│
│    └── SessionStore                                     │
│                                                         │
│  DbProjectScanner  implements ProjectScanner            │
│    ├── RawEventStore                                    │
│    └── SessionStore                                     │
│                                                         │
│  SessionManager                                         │
│    ├── scanner: SessionMigrator                         │
│    ├── reader: SessionReader                            │
│    ├── writer: SessionWriter                            │
│    └── filesystem: Filesystem  (RootGuardFilesystem)   │
└─────────────────────────────────────────────────────────┘
```

### 操作流程

**import（filesystem → DB）:**
```
new Transfer(
  new JsonlFileReader(filePath, guardedFs),
  dbWriter
).run(sessionId)
```

**export（DB → filesystem）:**
```
new Transfer(
  dbReader,
  new JsonlFileWriter(outputPath, guardedFs)
).run(sessionId)
```

### 關鍵決策

- `Transfer` 放在 `session-store`，只依賴兩個 interface，環境無關
- `FileReader`/`FileWriter`/`FileProjectScanner` 用 template method 抽出共用骨架，concrete 只實作 codec 部分
- `SessionMigrator.scanExportable()` 呼叫 `source.scanProjects()` 一次（建 Set），不對每個 session 呼叫 `hasSession`
- `DbSessionWriter.write()` 用 `appendBatch`（sequential inserts）取代 N 個並發 `appendEvent`
- import/export 兩側共用同一個 `RootGuardFilesystem` 實例（`guardedFs`）
- `SessionSummary.filePath`（原 `jsonlPath`）：命名不綁定格式
