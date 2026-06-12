## Why

測試品質審計發現 22 項問題，涵蓋 Skill 違規（不走真 pipeline、直接操作 state）、假綠（空 assertion、act 未 await）、重複測試、implementation detail 測試。需逐項修正以確保測試真正守護行為。

## What Changes

分兩個子 change 依序實作：

### Sub-change 1: `test-critical-fixes`（高優先 7 項）
1. act() 未 await → 加 await
2. 直接呼叫 context action → 改走 UI 驅動
3. 空 assertion → 補行為 expect
4. 不完整 Harness → 改用 renderWithWorkspace/renderWithChannel
5. sync.test.tsx rerender 餵 sessions → 改走真 pipeline
6. 模組級 mutable probe → 改為 test 內部 ref
7. Wrapper 重建 summoner → useRef lazy init

### Sub-change 2: `test-cleanup-polish`（中低優先 15 項）
8-22. 重複 describe 合併、重複測試刪除、className assert 改行為、zustand 直讀改 UI、closure probe 改 DOM、useCommandFeatures 改 toContain + 補 execute 測試、命名修正、settleDebounce 提取、SlideOverPane 重複刪除、RightPane onMention 補驗、it.each 簡化、vi.stubGlobal、contract test 重複刪除

## 開發紀律
每個子 change 必須遵循：
- **TDD**：重構時 **expect 不變或等價**
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`
- 行為刪除/搬移類重構先盤點舊載體的行為清單
