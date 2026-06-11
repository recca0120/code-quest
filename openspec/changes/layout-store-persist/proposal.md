## Why

LayoutStore 是純 in-memory Map，進程重啟後所有 workspace layout 消失。SettingsStore 已有成熟的 interface → InMemory/Drizzle 分層模式，LayoutStore 應仿效。另外 client `layout:save` 失敗時完全靜默，需加 toast 回饋。

## What Changes

### 1. LayoutStore interface 化 + async API
- 抽取 `LayoutStore` interface（`get` / `set` 均為 async）
- 現有 class rename 為 `InMemoryLayoutStore`（測試用）
- Production 透過 SettingsStore 落盤（key = `layout:{summonerId}`）

### 2. Handler / seed-layout 適配 async
- `layout.ts` handler 的 `layoutStore.get/set` 加 `await`
- `app.ts` handler 的 `layoutStore.get` 加 `await`
- `seed-layout.ts` 加 `await`

### 3. Client `layout:save` 失敗 toast
- `useLayoutPersistence.ts` 的 save callback 在 `ok: false` 時 toast.error

### 4. Spec Purpose 補完
- `openspec/specs/layout-sync/spec.md` Purpose 從 TBD 改為正式說明

## Out of Scope
- Drizzle migration / schema（用 SettingsStore 的 KV 機制，不需新 table）
- 獨立的 LayoutStore table（未來可考慮，目前 KV 足夠）
