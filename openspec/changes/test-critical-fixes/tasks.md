# Test Critical Fixes — Tasks

## 開發紀律（務必遵循）
- **TDD**：重構時 **expect 不變或等價**；不改行為，只改測試品質
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- 行為刪除/搬移類重構先盤點舊載體的行為清單（grep 測試引用），逐條判定消失或搬家
- tsc 錯誤只當收尾 checklist，不可當開發驅動
- **原則**：每個修正後 vitest 仍全 GREEN，expect 語意等價

## 1. act() 未 await

- [ ] 1.1 [impl] pane-zoom-swap-gate.test.tsx:190 — `act(() => mm.triggerChange(...))` → `await act(async () => ...)`
- [ ] 1.2 [impl] pane-zoom-swap-gate.test.tsx:207-214 — DnD swap 的 `act(() => actions()...)` → `await act(async () => ...)`
- [ ] 1.3 [impl] phase1-integration.test.tsx:207 — DnD arrange 的 `act()` → `await act(async () => ...)`
- [ ] 1.4 [verify] 全套 GREEN

## 2. 直接呼叫 context action → UI 驅動

- [ ] 2.1 [impl] pane-zoom-swap-gate.test.tsx:274,299,338 — `probeActions.setContentInPane/focusPane` → 走 PanePicker UI 或合理 arrange（如 launchSession）
- [ ] 2.2 [verify] expect 等價 GREEN

## 3. 空 assertion → 補行為 expect

- [ ] 3.1 [impl] GapFixes.test.tsx:61 — `resolves.toBeUndefined()` → 補驗 pane 數量減少或 session 狀態
- [ ] 3.2 [verify] GREEN

## 4. 不完整 Harness → renderWithWorkspace/renderWithChannel

- [ ] 4.1 [impl] phase1-integration.test.tsx — 自建 Harness → renderWithWorkspace
- [ ] 4.2 [impl] layout-sync-pipeline.test.tsx — 自建 renderClient → renderWithWorkspace
- [ ] 4.3 [impl] PaneTree.test.tsx — 自建 renderPaneTree → renderWithWorkspace
- [ ] 4.4 [impl] GapFixes.test.tsx Gap-2 — 自建 Wrapper → renderWithChannel
- [ ] 4.5 [verify] expect 等價 GREEN

## 5. sync.test.tsx rerender 餵 sessions → 真 pipeline

- [ ] 5.1 [impl] sync.test.tsx — `renderWithSessions` + `rerender` → 改走 createFakeServer + pushServerEvent('session:states')
- [ ] 5.2 [verify] 11 個測試 expect 等價 GREEN

## 6. 模組級 mutable probe → test 內部

- [ ] 6.1 [impl] pane-zoom-swap-gate.test.tsx:48 — `let probeState/probeActions` → renderTree() 回傳
- [ ] 6.2 [impl] sessions-diff.test.tsx:23 — `let stateProbe/actionsProbe` → beforeEach 重置或 test 內部
- [ ] 6.3 [impl] pane-content-shape.test.tsx:10 — `let probeState/probeActions` → renderProbe() 回傳
- [ ] 6.4 [impl] layout-persistence.test.tsx:161 — `initAckCount` → test 內部 let
- [ ] 6.5 [verify] GREEN

## 7. Wrapper 重建 summoner → useRef lazy init

- [ ] 7.1 [impl] WorktreeSwitcher.test.tsx — Wrapper 內 `createFakeSummoner()` → `useRef` lazy init + onTestFinished cleanup
- [ ] 7.2 [impl] RightPane.test.tsx — 同上
- [ ] 7.3 [verify] GREEN

## 8. 收尾

- [ ] 8.1 [verify] tsc clean + 全套 vitest GREEN
