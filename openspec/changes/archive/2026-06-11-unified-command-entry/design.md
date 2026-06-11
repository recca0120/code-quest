# Unified Command Entry — Design

## 核心概念

⌘K 開啟唯一 modal，**兩種模式共用同一個搜尋列**：

```
┌─────────────────────────────────────────────┐
│ ⌕ 搜尋 project / worktree / session…   esc │  ← picker 模式（預設）
├─────────────────────────────────────────────┤
│  Projects │ Worktrees │ 類型 grid / 進行中  │  ← Miller 三欄
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ › theme clay-dark                       esc │  ← 指令模式（› 前綴）
├─────────────────────────────────────────────┤
│  › 切換主題：Clay Dark ✓                    │  ← feature items（fuzzy match）
│  › 切換主題：Light                          │
│  › 切換主題：Roast                          │
│  › 字級：放大（⌘=）                         │
│  › 密度：Compact                            │
│  › search：搜尋對話訊息…                    │
└─────────────────────────────────────────────┘
```

## 入口

| 快捷鍵 | 行為 |
|---|---|
| ⌘K | 開 modal，搜尋列空（picker 模式） |
| ⌘⇧K | 開 modal，搜尋列預填 `›`（指令模式直達） |

## 模式切換

- 搜尋列文字以 `›` 開頭 → 指令模式（feature items 列表，fuzzy match `›` 後的文字）
- 搜尋列文字不以 `›` 開頭 → picker 模式（現有 Miller 三欄）
- 切換**即時**——打字就切，不需確認

## Modal shell

共用外殼，寬度隨模式變：
- picker 模式：`--picker-w-lg`（980px）/ `--picker-w-sm`（560px 單欄退化）
- 指令模式：`--palette-w`（640px）
- 圓角 `--radius-composer`（14px）；陰影 `--shadow-floating`
- `max-height: var(--palette-max-h)`（`min(480px, 64vh)`）；超出捲動
- 進場動效：scale 0.98→1 + fade，duration `--dur-palette`（160ms）

## 指令模式內容（feature items）

來自現有 CommandPalette 的 feature registry：
- **theme**：切換主題（clay-dark/light/roast/auto）
- **font-size**：字級放大/縮小/重設（⌘=/⌘-/⌘0）
- **density**：Compact/Default/Relaxed
- **search**：`›search {query}` → 搜尋對話訊息（現有 CommandPalette 的 Messages tab 功能）
- 未來可擴充：plugin 指令、file jump、git 操作等

fuzzy 命中字元底色 `--color-palette-match`（accent 30%）。
列高 `--palette-row-h`（36px，隨 density 32/36/40）。

## 實作路徑

1. PanePicker.tsx 搜尋列加 `›` 偵測——`query.startsWith('›')` 切換 view
2. 指令模式 view 消費 feature items（從 feature registry import，不重建）
3. CommandPaletteContext 的 `openPalette({ tab })` 改為 `openPicker({ mode: 'command' })`
4. CommandPalette.tsx 元件保留但不再獨立 mount——其 feature 收集邏輯抽成 `useCommandFeatures()` hook
5. Workspace.tsx 的 `⌘⇧K → openPalette()` 改為 `⌘⇧K → openPicker({ prefill: '›' })`

## 不動的

- PanePicker 的三欄結構、鍵盤協定、⏎/⌘⏎ 行為——picker 模式不變
- feature registry（font-size-feature/density-feature/color-theme-feature）——指令模式消費它
- 訊息搜尋的 UI（MessageList filter/jump）——由 `›search` 指令觸發
