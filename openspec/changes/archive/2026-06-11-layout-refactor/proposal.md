## Why

Layout persistence 系統有三類技術債：
1. **命名分裂**：client 端 `PaneContent.sessionId` 語意上是 channelId（live channel），wire schema 正確用 `channelId`，pane-codecs 做無意義的 rename mapping
2. **無落盤**：LayoutStore 純 in-memory Map，進程重啟 layout 全失
3. **錯誤靜默**：`layout:save` 失敗時 client 無任何回饋

## What Changes

分兩個子 change 依序實作：

### Sub-change 1: `pane-channelid-unify`
- `PaneContent.sessionId` → `channelId`（型別 + 12 個元件 + 3 個 context）
- `pane-codecs.ts` 消除 rename mapping（兩側名稱一致，直接 spread）
- `findPaneBySession` → `findPaneByChannel`
- `setSessionInPane` / `splitPaneAndAssign` 參數名 → channelId
- **保留** `onResume(sessionId)` — 真正的 DB session ID，語意正確
- TDD 重構：先改測試到目標態（RED）→ 改型別和實作（GREEN）→ tsc 收尾

### Sub-change 2: `layout-store-persist`
- LayoutStore 從 in-memory Map → 檔案落盤（async API）
- client `layout:save` 失敗時 toast 提示
- `openspec/specs/layout-sync/spec.md` Purpose 補完
- `seed-layout.ts` 適配 async
- TDD：先改測試 expect 到 async 目標態（RED）→ 實作 async store（GREEN）

## 開發紀律
每個子 change 必須遵循：
- **TDD**：先測試（RED）再實作（GREEN）；重構時 expect 不變或等價
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`
- 行為刪除/搬移類重構先盤點舊載體的行為清單，逐條判定消失或搬家
