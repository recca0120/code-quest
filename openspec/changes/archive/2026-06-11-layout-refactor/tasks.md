# Layout Refactor — Tasks（總 change）

## 開發紀律（所有 sub-change 共通，務必遵循）
- **TDD**：先測試（RED）再實作（GREEN）；重構時 expect 不變或等價
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- 行為刪除/搬移類重構先盤點舊載體的行為清單（grep 測試引用），逐條判定消失或搬家，測試全部改到目標態之後才動實作
- tsc 錯誤只當收尾 checklist，不可當開發驅動

## Sub-changes

- [x] 1. `pane-channelid-unify` — sessionId → channelId 命名統一 + codecs 簡化
- [x] 2. `layout-store-persist` — LayoutStore 落盤 + 錯誤處理 + spec 補完
