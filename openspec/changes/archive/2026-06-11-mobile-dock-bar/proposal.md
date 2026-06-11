## Why

Design §8 RWD mobile 視圖底部有一列獨立的 dock chips（高 40px），顯示 pane type 快捷入口（▤ files・± git・◈ spec）+ hint 文字。目前 production 的 `PaneDock` 是 chat pane 的 rail 收合態（§3），不是 mobile 專屬底部列。兩者語意不同。

## What Changes

新增 `MobileDockBar` 元件：
- 僅在 mobile mode 渲染
- 固定在視窗底部，高度 40px（`--hit-dock-chip`）
- 顯示 pane type chips（從 `PANE_TYPE_REGISTRY` 讀取，排除 chat）
- 點 chip → 在 focused pane 開對應 tool pane（或開 drawer）
- 右端 hint「左右滑切 pane」
- 加 `env(safe-area-inset-bottom)` padding

## Out of Scope
- 桌面/tablet 的 dock chips（已由 PaneDock 處理）
- Drawer bottom sheet 功能（已實作）
