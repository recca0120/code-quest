## Why

像素級比對 design CSS（tmux.css + tokens.css）和 production code 後發現 32 處不對齊。涵蓋字級、間距、顏色、z-index、元件形狀等。需逐項修正以達到 design spec 的 high-fidelity 要求。

## What Changes

### CRITICAL（14 項）— 視覺明顯不同
- Pane header：toolbar font-size 14→11.5px、action gap 2→7px、button color muted→subtle、meta font-size 10→11.5px
- ZoomBar：主文案 font-size 14→11.5px
- Drawer：header title 14→12px、pin 按鈕樣式還原 accent-soft
- PanePicker：overlay 60%→38%、搜尋列 padding 8→16px
- SlideOverPane：inset-0→10px、四邊 border+圓角 12px
- MobileTopBar：高度 44→48px、pane dot 改 22×22 chip、tab dropdown 加 pill 邊框
- DropZones：z-index 1→12

### WARNING（18 項）— 小幅偏差
- TabBar logo：gap/margin/font-weight/font-size 微調
- Statusline：padding-x 12→10px
- Rail/Dock count：顏色和字級
- Divider/DropZones/Ghost：hover bg、label 字級顏色、border color
- PanePicker：icon size、section-label weight
- MobilePaneWall：padding、card 圓角
- ZoomBar：bottom border color

## Out of Scope
- 斷點值（640 vs 768）— 已定案用 768
- Heroicons vs Unicode glyph — 已定案用 Heroicons
