# Proposal: Design Alignment Audit

## Summary

對照 `docs/design/design_handoff_tmux_workspace/README.md` 與 `tokens/App.proposal.css`，修正目前 workspace 實作與 design spec 之間的所有偏差。

## Motivation

經過完整審計，發現 26 處偏差（2 高 / 8 中 / 16 低），涵蓋 RWD 斷點錯誤、缺失功能（diffstat）、視覺/互動不一致等。需逐一修正以達到 design spec 的 pixel-level fidelity。

## Scope

### 高優先
- RWD tablet 斷點從 768px 修正為 640px
- Drawer header 補上 diffstat 顯示

### 中優先
- Logo text 在 640–768px 不應隱藏
- Tab busy 燈常駐佔位（visibility 控制，非 conditional render）
- Focused pane border mix 對象改為 transparent
- Permission mode 字串對齊確認
- Split 被拒時顯示 toast
- Rail hint 文字無條件完整渲染
- Palette 加 min-width: 90vw
- Drawer pin 按鈕改為 primary filled style

### 低優先
- Badge 圓角 4→5px（--radius-chip 改回 5px 需評估影響範圍）
- 標題字級 11.5→12px
- Icon glyph 一致性（維持 heroicons，spec 建議可替換）
- Git count +N 前綴
- i18n 文字（中/英）
- Stale comment 修正
- Statusline busy dot 5→6px（已有 deliberate choice 註解）
- Dock chip inner height 28→40px 確認
- PanePicker 單欄退化點
- Rail 多餘按鈕

## Non-goals

- 不新增功能（Chat Rail 整體元件已存在，只修偏差）
- 不動 pane-tree 資料結構
- 不改 server protocol
