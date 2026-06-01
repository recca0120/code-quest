## Architecture

### 完整依賴圖

```
┌─────────────────────────────────────────────────────────┐
│                    jsonl-codec                          │
│                                                         │
│  interface JsonlReader                                  │
│    read(sessionId): Promise<SessionData>                │
│                                                         │
│  interface JsonlWriter                                  │
│    write(sessionId, data): Promise<void>                │
│                                                         │
│  interface ProjectList                                  │
│    scanProjects(): Promise<ProjectSummary[]>            │
│    hasSession(sessionId): Promise<boolean>              │
│    countEvents(sessionId): Promise<number>              │
│                                                         │
│  Converter(reader, writer)                              │
│    convert(sessionId): Promise<void>                    │
│                                                         │
│  JsonlFileReader  implements JsonlReader                │
│    └── Filesystem                                       │
│                                                         │
│  JsonlFileWriter  implements JsonlWriter                │
│    └── Filesystem                                       │
│                                                         │
│  JsonlProjectScanner  implements ProjectList            │
│    └── Filesystem                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                      server                             │
│                                                         │
│  JsonlDbReader  implements JsonlReader                  │
│    ├── RawEventService                                  │
│    └── SessionStore                                     │
│                                                         │
│  JsonlDbWriter  implements JsonlWriter                  │
│    ├── RawEventService                                  │
│    └── SessionStore                                     │
│                                                         │
│  DbProjectList  implements ProjectList      ← new       │
│    ├── RawEventService                                  │
│    └── SessionStore                                     │
│                                                         │
│  SessionScanner                                         │
│    ├── filesystemList: ProjectList                      │
│    └── dbList: ProjectList                              │
│                                                         │
│  SessionManager                                         │
│    ├── scanner: SessionScanner                          │
│    ├── dbReader: JsonlReader                            │
│    ├── dbWriter: JsonlWriter                            │
│    └── filesystem: Filesystem                           │
└─────────────────────────────────────────────────────────┘
```

### 操作流程

**import（filesystem → DB）:**
```
new Converter(
  new JsonlFileReader(jsonlPath, filesystem),
  dbWriter
).convert(sessionId)
```

**export（DB → filesystem）:**
```
new Converter(
  dbReader,
  new JsonlFileWriter(outputPath, filesystem)
).convert(sessionId)
```

### 關鍵決策

- `Converter` 放在 `jsonl-codec`，只依賴兩個 interface，可在任何環境使用
- `ProjectList.countEvents()` 用於 `resolveImportStatuses` 的 import threshold 計算
- `JsonlFileReader`/`JsonlFileWriter` constructor 持有 path（構建時決定），不在 read/write 時傳入
- `SessionManager` 每次操作時建立 `Converter` 實例（per-operation），不持有固定 converter
