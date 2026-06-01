## Tasks

### jsonl-codec — 新增 interface 與 class

- [ ] 新增 `ProjectList` interface（`scanProjects`, `hasSession`, `countEvents`）
- [ ] 新增 `Converter` class（`constructor(reader, writer)`, `convert(sessionId)`）
- [ ] `JsonlProjectScanner` 實作 `ProjectList` interface
- [ ] 新增 `ProjectList` / `Converter` 到 `index.ts` export

### server — 新增 DbProjectList

- [ ] 新增 `DbProjectList implements ProjectList`（依賴 `RawEventService` + `SessionStore`）
- [ ] `scanProjects()` — 從 `SessionStore.list()` 組成 `ProjectSummary[]`
- [ ] `hasSession(sessionId)` — 從 `SessionStore.getById()` 判斷
- [ ] `countEvents(sessionId)` — 從 `RawEventService.countBySession()`
- [ ] 補齊 `DbProjectList` 測試

### server — 重構 SessionScanner

- [ ] 移除 `RawEventService`、`SessionStore`、`writer`、`reader` 依賴
- [ ] constructor 改為 `(filesystemList: ProjectList, dbList: ProjectList)`
- [ ] `scanProjects()` 改用 `filesystemList` + `dbList.hasSession()`
- [ ] `resolveImportStatuses()` 改用 `dbList.countEvents()`
- [ ] `scanExportable()` 改用 `dbList.scanProjects()` + `filesystemList.hasSession()`
- [ ] 移除 `importSession()`、`exportSession()`（移至 SessionManager）
- [ ] 更新 `SessionScanner` 測試

### server — 重構 SessionManager

- [ ] constructor 加入 `dbReader: JsonlReader`、`dbWriter: JsonlWriter`、`filesystem: Filesystem`
- [ ] 新增 `importSession(jsonlPath)` — 用 `Converter(FileReader, dbWriter).convert()`
- [ ] 新增 `exportSession(sessionId, outputPath)` — 用 `Converter(dbReader, FileWriter).convert()`
- [ ] `runImport()` / `runExport()` 改呼叫 `this.importSession()` / `this.exportSession()`
- [ ] 更新 `session-manager.entry.ts` 組裝新依賴

### 收尾

- [ ] 移除 `JsonlDbReader`、`JsonlDbWriter` 若已被 `DbProjectList` 完全取代（視情況）
- [ ] 全部測試通過
