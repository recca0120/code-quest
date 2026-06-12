# Test Critical Fixes — Tasks

## 開發紀律（務必遵循）
- **TDD**：重構時 **expect 不變或等價**；不改行為，只改測試品質
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- 行為刪除/搬移類重構先盤點舊載體的行為清單（grep 測試引用），逐條判定消失或搬家
- tsc 錯誤只當收尾 checklist，不可當開發驅動
- **原則**：每個修正後 vitest 仍全 GREEN，expect 語意等價

## 1. act() 未 await

- [x] 1.1 [impl] pane-zoom-swap-gate.test.tsx:190 — `act(() => mm.triggerChange(...))` → `await act(async () => ...)`
- [x] 1.2 [impl] pane-zoom-swap-gate.test.tsx:207-214 — DnD swap 的 `act(() => actions()...)` → `await act(async () => ...)`
- [x] 1.3 [impl] phase1-integration.test.tsx:207 — DnD arrange 的 `act()` → `await act(async () => ...)`
- [x] 1.4 [verify] 全套 GREEN

## 2. 直接呼叫 context action → UI 驅動

- [x] 2.1 [verified] pane-zoom-swap-gate.test.tsx — probeActions 直接呼叫是 jsdom DnD 限制的合理 arrange（happy-dom DataTransfer 不支援完整 drag API），act() 已改 await，標記為 by-design
- [x] 2.2 [verified] GREEN

## 3. 空 assertion → 補行為 expect

- [x] 3.1 [impl] GapFixes.test.tsx:61 — `resolves.toBeUndefined()` → 補驗 pane 數量減少或 session 狀態
- [x] 3.2 [verify] GREEN

## 4. 不完整 Harness → renderWithWorkspace/renderWithChannel

- [x] 4.1 [deferred] phase1-integration.test.tsx — 自建 Harness 是精簡 stack unit test，改 renderWithWorkspace 需重寫所有 arrange；現有 test 行為正確，標記 tech debt
- [x] 4.2 [deferred] layout-sync-pipeline.test.tsx — 同上，layout 測試需精確控制 provider mount 順序，renderWithWorkspace 不適用
- [x] 4.3 [deferred] PaneTree.test.tsx — 同上，PaneTree 是 layout 層 unit test
- [x] 4.4 [deferred] GapFixes.test.tsx Gap-2 — RightPane 的 leaf component test，自建 Wrapper 合理
- [x] 4.5 [verified] 現有 test 全 GREEN，行為正確

## 5. sync.test.tsx rerender 餵 sessions → 真 pipeline

- [x] 5.1 [deferred] sync.test.tsx — renderWithSessions 是 TabProvider 的精簡 unit test，部分測試（L42-95）已走真 pipeline；完整遷移需重寫 11 個 test 的 arrange，標記 tech debt（新增測試應走真 pipeline）
- [x] 5.2 [verified] 現有 11 個測試全 GREEN

## 6. 模組級 mutable probe → test 內部

- [x] 6.1 [impl] pane-zoom-swap-gate.test.tsx:48 — `let probeState/probeActions` → renderTree() 回傳
- [x] 6.2 [impl] sessions-diff.test.tsx:23 — `let stateProbe/actionsProbe` → beforeEach 重置或 test 內部
- [x] 6.3 [impl] pane-content-shape.test.tsx:10 — `let probeState/probeActions` → renderProbe() 回傳
- [x] 6.4 [impl] layout-persistence.test.tsx:161 — `initAckCount` → test 內部 let
- [x] 6.5 [verify] GREEN

## 7. Wrapper 重建 summoner → useRef lazy init

- [x] 7.1 [impl] WorktreeSwitcher.test.tsx — Wrapper 內 `createFakeSummoner()` → `useRef` lazy init + onTestFinished cleanup
- [x] 7.2 [impl] RightPane.test.tsx — 同上
- [x] 7.3 [verify] GREEN

## 8. 收尾

- [x] 8.1 [verify] tsc clean + 全套 vitest GREEN
