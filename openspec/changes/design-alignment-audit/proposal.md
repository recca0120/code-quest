## Why

Design handoff（docs/design/design_handoff_tmux_workspace/README.md）全面審計後發現 33 處 production code 與設計規格不對齊。涵蓋 token 值、元件樣式、缺失功能、dead code。需逐項修正以達到 design spec 的 high-fidelity 要求。

## What Changes

### CRITICAL（5 項）
1. `App.css` `[data-theme="dark"]` → `[data-theme="clay-dark"]`（選擇器不命中）
2. Pane header 標題字級 14px → 12px（`--text-ui`）
3. Statusline 字級 10px → 10.5px（`--text-statusline`）
4. Mobile 拖曳未禁用 → `draggable={!isMobile}`
5. SlideOverPane `onPinToSplit` 未接線

### WARNING（11 項）
6. `--radius-chip` 4px → 5px
7. Rail/Dock tab 字級 10px → 11px
8. 底部 hint 文字不完整（Rail + Dock）
9. ZoomBar + DropZones `bg-accent/10` → `bg-accent-soft` token
10. MobileTopBar pane dots 14px → 22px
11. Drawer ⊞ 按鈕 accent-soft → primary 樣式
12. Drawer diffstat 未實作（TODO）
13. `ds.font` dead code + 舊 `[data-font]` CSS
14. reduced-motion 漏 `--theme-transition`
15. PanePicker Miller 列缺 minHeight
16. Mobile 斷點 768 vs design 640（需確認）

### Dead Code（7 項）
17-23. SessionBar test 名殘留、noop TODO、registerActions 可移除、comment 過期等

## Out of Scope
- Drawer diffstat 完整實作（只清 TODO 註解，不實作 git diffstat 功能）
- Mobile 斷點值變更（需討論，本次只記錄）
- Heroicons vs Unicode glyph 選擇（已定案用 Heroicons）
