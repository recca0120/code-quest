## Tasks

### 1. RawEventStore — hasEvents (LIMIT 1)
- [x] 🔴 `raw-event-store.ts`: 加 `hasEvents(sessionId): Promise<boolean>` 到 interface
- [x] 🔴 `raw-event-service.ts`: delegate
- [x] 🟢 `drizzle-raw-event-store.ts`: LIMIT 1 實作
- [x] 🟢 `composite-raw-event-store.ts`: delegate to primary
- [x] 🟢 `db-writer.ts`: 改用 `hasEvents` 取代 `getBySession`
- [x] 測試通過

### 2. JsonlSession.decodableLines — 一次讀檔
- [x] 🔴 `JsonlSession` 加 `decodableLines: number`
- [x] 🟢 `scanSessions` 順帶計算並填入（single-pass，extractSessionMeta 同步計算）
- [x] 🟢 `countDecodableLines` 移除，直接用 `session.decodableLines`
- [x] 測試通過

### 3. runImport — 善用已有 importedIds
- [x] 🟢 `ProjectInfo` 帶 `importedIds: ReadonlySet<string>`，`resolveImportStatuses` 接受可選參數
- [x] 🟢 `runImport` 傳入 `projectChoice.importedIds`，跳過 NOT_IMPORTED 的 DB 查詢
- [x] 測試通過

### 額外優化（實作過程發現）
- [x] `countBySession`（COUNT SQL）取代 `getDbCount`（載全部 events）
- [x] `DbWriter`/`DbReader` constructor 一次建立，不在每次呼叫 new
- [x] `hasUserEcho` 改 `.select({ id })` 避免載大型 `raw` 欄位
- [x] `decodeSession` single-pass，`parseLine` 結果傳給 `readLine` 避免 double-parse
- [x] `scanProjects`/`scanSessions` 改 `Promise.all` 並行
- [x] `scanExportable` `fileExists` 改 `Promise.all` 並行
