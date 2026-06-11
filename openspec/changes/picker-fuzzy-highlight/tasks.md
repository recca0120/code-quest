# Picker Fuzzy Highlight — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. Fuzzy match 工具函式

- [x] 1.1 [test] fuzzyMatch('theme', '切換主題：Clay Dark') → { match: true, indices: [...] }
- [x] 1.2 [test] fuzzyMatch('xyz', '切換主題：Clay Dark') → { match: false }
- [x] 1.3 [test] fuzzyMatch('', '任意文字') → { match: true, indices: [] }（空 query 全匹配）
- [x] 1.4 [impl] fuzzyMatch(query, text) → { match: boolean, indices: number[] }（連續子序列）

## 2. Highlight 渲染工具

- [x] 2.1 [test] highlightByIndices('hello', [1,3]) → [plain 'h', mark 'e', plain 'l', mark 'l', plain 'o']
- [x] 2.2 [impl] highlightByIndices(text, indices) → Array<{ text, match }>（與現有 highlight 函式同格式）

## 3. CommandModeView 整合

- [x] 3.1 [test] PanePicker 指令模式：輸入 ›theme → 過濾結果含 theme 相關項目 + 命中字元有 mark 元素（bg-palette-match）
- [x] 3.2 [test] PanePicker 指令模式：輸入 ›tm → fuzzy 匹配 theme（非 substring）
- [x] 3.3 [impl] CommandModeView：替換 includes filter 為 fuzzyMatch；渲染 label 用 highlightByIndices + mark 底色 `bg-(--color-palette-match)`

## 4. 收尾

- [x] 4.1 [verify] tsc clean + 全套 vitest green
- [x] 4.2 [verify] 瀏覽器驗證：⌘⇧K → ›theme → 命中字元高亮可見
