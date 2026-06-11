# Unified Command Entry — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline＋priming＋UI 驅動＋多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）


TDD；測試照 fake-summoner-client skill。

## 1. 指令模式偵測與切換

- [x] 1.1 [test] PanePicker：搜尋列輸入 `›theme` → 三欄隱藏、顯示指令列表（data-testid="command-mode"）；刪掉 `›` → 回三欄
- [x] 1.2 [impl] PanePicker query state 加 `›` 前綴偵測；條件渲染 CommandModeView vs Miller 三欄

## 2. Feature items 抽取

- [x] 2.1 [test] useCommandFeatures hook：回傳 feature items 陣列（至少含 theme/font-size/density/search 四組）
- [x] 2.2 [impl] 從 CommandPalette.tsx 抽出 feature 收集邏輯為 useCommandFeatures()

## 3. 指令模式 UI

- [x] 3.1 [test] CommandModeView：fuzzy match `›` 後文字過濾 items；⏎ 執行選中項；esc 關閉 modal
- [x] 3.2 [impl] CommandModeView 元件（列高 --palette-row-h、命中底色 --color-palette-match）
- [ ] 3.3 [test] `›search` 指令：選中後切到訊息搜尋 view（沿用 CommandPalette 的 Messages filter UI）
- [ ] 3.4 [impl] 訊息搜尋整合（MessageList jumpTo 路徑保留）

## 4. 入口接線

- [x] 4.1 [test] ⌘K 開 modal（picker 模式）；⌘⇧K 開 modal 且搜尋列預填 `›`（指令模式）
- [x] 4.2 [impl] KeyboardShortcutsProvider / Workspace.tsx 接線；CommandPaletteContext → PanePicker open state 合併
- [ ] 4.3 [test+impl] CommandPalette.tsx 獨立 mount 移除（<CommandPalette /> 從 Workspace render tree 拿掉）；CommandPaletteContext 簡化為 open/prefill state

## 5. Modal shell 動態寬

- [ ] 5.1 [test] picker 模式寬 980px；指令模式寬 640px（同一 modal，寬度跟模式走）
- [ ] 5.2 [impl] Dialog size 動態切換（picker vs palette）
- [ ] 5.3 [test] 進場動效 scale 0.98→1 + fade（--dur-palette 160ms）
- [ ] 5.4 [impl] Dialog 進場 CSS

## 6. 收尾

- [ ] 6.1 [verify] 全套綠 + Playwright：⌘K → 三欄 → 打 › → 指令列表 → theme clay-dark → 切回三欄
- [ ] 6.2 [cleanup] 移除孤立的 CommandPalette 相關 dead code（若有）
