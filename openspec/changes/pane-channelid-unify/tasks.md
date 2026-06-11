# Pane channelId Unify — Tasks

## 開發紀律（務必遵循）
- **TDD**：先測試（RED）再實作（GREEN）；重構時 **expect 不變或等價**
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- 行為刪除/搬移類重構先盤點舊載體的行為清單（grep 測試引用），逐條判定消失或搬家，測試全部改到目標態之後才動實作
- tsc 錯誤只當收尾 checklist，不可當開發驅動
- **重構原則**：這是純 rename，不改行為。每個測試的 expect 語意必須等價（只是欄位名從 sessionId 變 channelId）

## 1. 盤點（先做，不改 code）

- [ ] 1.1 [盤點] grep 所有 `content.sessionId` 引用，列出完整清單（production code + test code）
- [ ] 1.2 [盤點] 區分「真 DB sessionId」vs「實際是 channelId 的 sessionId」的引用，確認哪些要改哪些保留

## 2. 測試先行（RED）— 改測試到目標態

- [ ] 2.1 [test] pane-tree 相關測試：所有 `content.sessionId` → `content.channelId`（expect 等價）
- [ ] 2.2 [test] pane-codecs 相關測試：移除 rename mapping 的 assertion，改為 channelId 直通
- [ ] 2.3 [test] layout-persistence 相關測試：`sessionId` → `channelId` 在 pane content 結構中
- [ ] 2.4 [test] workspace-chrome / SessionPane / TabContainer 等元件測試：`content.sessionId` → `content.channelId`
- [ ] 2.5 [verify] 確認所有改動的測試現在 RED（因為 production code 還沒改）

## 3. 實作（GREEN）— 改 production code

- [ ] 3.1 [impl] `pane-tree.ts`：`PaneContent` 型別 `sessionId → channelId` + 所有函式體
- [ ] 3.2 [impl] `pane-codecs.ts`：消除 rename mapping（serialize/deserialize 直接用 channelId）
- [ ] 3.3 [impl] `WorkspaceLayoutContext.tsx`：action 參數名 sessionId → channelId
- [ ] 3.4 [impl] 12 個元件檔：`content.sessionId` → `content.channelId`
- [ ] 3.5 [impl] `findPaneBySession` → `findPaneByChannel`（函式名 + 所有 call sites）
- [ ] 3.6 [verify] tsc clean + 全套 vitest green（expect 全部等價通過）

## 4. 收尾

- [ ] 4.1 [verify] grep 確認無殘留 `content.sessionId`（除了真 DB sessionId 的合法引用）
- [ ] 4.2 [verify] pane-codecs.ts 無 rename mapping 殘留
