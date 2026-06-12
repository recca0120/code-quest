# Test Cleanup Polish — Tasks

## 開發紀律（務必遵循）
- **TDD**：重構時 **expect 不變或等價**；不改行為，只改測試品質
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline）
- 刪除重複測試前先確認行為覆蓋不減少
- tsc 錯誤只當收尾 checklist

## 1. 重複 describe/test 合併

- [x] 1.1 [impl] workspace-chrome.test.tsx — 兩個「⌘⇧K」describe 合為一個
- [x] 1.2 [impl] Workspace.test.tsx — 重複 it（cross-project 兩個同行為）刪一個
- [x] 1.3 [impl] Workspace.test.tsx — Settings button 兩個 it（存在 + 點擊）合一
- [x] 1.4 [impl] sync.test.tsx — 重複 it（creates tab / adds tabs）合一
- [x] 1.5 [impl] sync.test.tsx — 重複 it（preserves cwd 兩處）刪一
- [x] 1.6 [impl] state.test.tsx — setTabTitle/setTabStatus 各兩個 it，前者被後者覆蓋，刪前者
- [x] 1.7 [impl] pane-tree/pane-content-shape — setSessionInPane 重複，保留更完整的
- [x] 1.8 [impl] SlideOverPane.test.tsx — describe 6.1 完全重複 2.1，刪一
- [x] 1.9 [impl] layout-v2.contract.test.ts — rail without width 重複，合併

## 2. className assert → 行為 assert

- [x] 2.1 [impl] PanePicker.test.tsx:145-155 — flex-col/lg:flex-row → 改驗 RWD 斷點行為或移除
- [x] 2.2 [impl] PanePicker.test.tsx:415-427 — picker-w/palette-w → 改驗 dialog 尺寸語意
- [x] 2.3 [impl] SlideOverPane.test.tsx — className regex → 改驗 testid + visible prop

## 3. useCommandFeatures 改善

- [x] 3.1 [impl] ids.some().toBe(true) → toContain 精確 ID
- [x] 3.2 [impl] 補 execute() 呼叫測試（至少一個 feature 驗 store 變化）

## 4. 其他清理

- [x] 4.1 [impl] settleDebounce 提取到 @/test/helpers（pane-rail + layout-sync-pipeline 共用）
- [x] 4.2 [impl] useEffectiveColorTheme.test — 手動 restore → vi.stubGlobal
- [x] 4.3 [impl] preferences-schema.test — 重複 safeParse → it.each
- [x] 4.4 [impl] channel-manager.test — describe 名稱 getAllChannelIds → 正確方法名
- [x] 4.5 [impl] layout.test — .on() → receivedEvents() 慣例（如可行）

## 5. 收尾

- [x] 5.1 [verify] tsc clean + 全套 vitest GREEN
