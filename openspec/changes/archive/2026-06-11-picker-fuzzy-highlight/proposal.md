## Why

Design §4b 明確要求指令模式使用 fuzzy match 且命中字元以 `--color-palette-match`（accent 30%）底色高亮。目前 production 用 substring `includes` 過濾，無命中字元標記。

## What Changes

1. **Fuzzy filter**：CommandModeView 的過濾邏輯從 `label.includes(query)` 改為 fuzzy match（連續子序列匹配）
2. **命中字元高亮**：匹配到的字元以 `--color-palette-match` 底色標記（與 PaletteMessageList 的 highlight 同規格）
3. **共用 highlight 函式**：抽取通用的 fuzzy match + highlight 工具，CommandModeView 和 PaletteMessageList 共用

## Out of Scope
- Miller 三欄的搜尋過濾（已用 substring，非指令模式）
- 訊息搜尋的 fuzzy（已用 substring，設計未要求 fuzzy）
