# jsonl-session-perf

## Problem

Three performance issues found in simplify review:

1. `DbWriter.write` calls `getBySession(sessionId)` (loads ALL events) just to check if any exist.
2. `scanSessions` reads each JSONL file in full; `countDecodableLines` reads the same file again later.
3. `runImport` calls `getDbCount` (→ `getBySession`, loads ALL events) per session even for sessions already known to be NOT_IMPORTED from the `importedIds` set.

## Solution

1. Add `hasEvents(sessionId): Promise<boolean>` to `RawEventStore` / `RawEventService` using `LIMIT 1`.
2. Add `decodableLines: number` to `JsonlSession`; compute during `scanSessions`, reuse in `countDecodableLines`.
3. In `SessionScanner.getImportStatus`, skip the `countDecodableLines` call when `dbCount === 0`.
   In `runImport`, derive `NOT_IMPORTED` from the already-loaded `importedIds` set, only query DB for sessions that need PARTIAL check.
