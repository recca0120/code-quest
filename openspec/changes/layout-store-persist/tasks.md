# Layout Store Persist — Tasks

## 開發紀律（務必遵循）
- **TDD**：先測試（RED）再實作（GREEN）；重構時 **expect 不變或等價**
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- 行為刪除/搬移類重構先盤點舊載體的行為清單（grep 測試引用），逐條判定消失或搬家，測試全部改到目標態之後才動實作
- tsc 錯誤只當收尾 checklist，不可當開發驅動

## 1. LayoutStore interface 化

- [x] 1.1 [test] layout.test.ts：現有 LayoutStore 測試改用 async API（get → await get, set → await set）
- [x] 1.2 [impl] 抽取 `LayoutStore` interface（get: async, set: async）；現有 class rename 為 `InMemoryLayoutStore` implements LayoutStore
- [x] 1.3 [verify] 現有 layout.test.ts 全套 GREEN（expect 等價，只是 async）

## 2. Handler 適配 async

- [x] 2.1 [impl] layout.ts handler：`layoutStore.get/set` 加 await
- [x] 2.2 [impl] app.ts handler：`layoutStore.get` 加 await
- [x] 2.3 [impl] seed-layout.ts：加 await
- [x] 2.4 [verify] server tests GREEN

## 3. SettingsStore 落盤

- [x] 3.1 [test] layout.test.ts 新增：restart 後 layout 仍在（透過 SettingsStore 持久化驗證）
- [x] 3.2 [impl] `SettingsLayoutStore` class：透過 SettingsStore KV 存取（key = `layout:{summonerId}`），implements LayoutStore
- [x] 3.3 [impl] container.ts：production 注入 SettingsLayoutStore，test 用 InMemoryLayoutStore
- [x] 3.4 [verify] 全套 server tests GREEN

## 4. Client toast

- [x] 4.1 [test] renderWithWorkspace：layout:save 失敗 → toast 顯示
- [x] 4.2 [impl] useLayoutPersistence.ts：save callback `ok: false` 時 toast.error

## 5. Spec + 收尾

- [x] 5.1 [impl] openspec/specs/layout-sync/spec.md Purpose 補完
- [x] 5.2 [verify] tsc clean + 全套 vitest green（server + web）
