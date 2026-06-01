## 已完成

### packages/jsonl-codec/
- ✅ `JsonlDecoder`：JSONL lines → RawEvent（純轉換）
- ✅ `JsonlEncoder`：RawEvent → JSONL line（純轉換，internal only）
- ✅ `SessionData` / `SessionSource` / `SessionSink` interfaces（types.ts）
- ✅ `JsonlFileReader implements SessionSource`：constructor(jsonlPath)
- ✅ `JsonlFileWriter implements SessionSink`：constructor(outputPath)，注入 sessionId + cwd
- ✅ `MemoryReader` / `MemoryWriter`：for testing
- ✅ `makeDefaultSessionRecord(id)` exported
- ✅ `JsonlProjectScanner(fs, claudeProjectsDir)`：scanProjects / scanSessions / countDecodableLines
- ✅ 所有測試通過

### apps/server/
- ✅ `DbReader implements SessionSource`
- ✅ `DbWriter implements SessionSink`（skip guard，並行寫入）
- ✅ `SessionScanner`：掃描 FS + DB 狀態判斷
- ✅ `session-manager` CLI：互動式 TUI
- ✅ 所有測試通過（761 tests）

## 待實作：重構 server 層

### 1. packages/jsonl-codec/ — JsonlProjectScanner.fileExists

- [x] 1.1 🔴 `JsonlProjectScanner.fileExists(absolutePath): Promise<boolean>` 測試
- [x] 1.2 🟢 實作（委派給注入的 `fs.exists()`）

### 2. apps/server/ — SessionScanner 接受注入的 JsonlProjectScanner

- [x] 2.1 `SessionScanner` constructor 改為 `(rawEventService, sessionStore, projectScanner?, claudeProjectsDir?)`
      — 預設仍自行 new，但可注入 for testing
- [x] 2.2 `scanExportable()` 改用 `this.projectScanner.fileExists()` 取代 `stat()`

### 3. apps/server/ — SessionManager class + inline importSession/exportSession

- [x] 3.1 `session-manager.ts` 改為 `SessionManager` class，`run/runImport/runExport` 變 method
- [x] 3.2 `importSession` / `exportSession` inline 到 `session-manager.ts`（module-level，保留可測試性）
- [x] 3.3 🔴 更新 `jsonl-importer.test.ts` / `jsonl-exporter.test.ts` 指向 `session-manager.ts`
- [x] 3.4 🟢 刪除 `services/jsonl-importer.ts` / `services/jsonl-exporter.ts`

### 4. 驗證

- [x] 4.1 全部測試綠燈
- [x] 4.2 跑 `pnpm --filter @code-quest/server session-manager` 確認功能正常
