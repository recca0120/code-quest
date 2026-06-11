# Tablet Slide-Over — Design

## 概念

```
┌──────────────────────────────────────┐
│ main pane (100%)                     │
│                                      │
│                  ┌───────────────────┤
│                  │ slide-over (58%)  │
│                  │ z-25, r-12        │
│                  │                   │
│                  │ ← 右滑收回        │
│                  │ → 左拖釘選成 split│
│                  └───────────────────┤
└──────────────────────────────────────┘
```

## 觸發條件

- viewport 寬 640–1024 **且** orientation: portrait
- pane tree 有 ≥2 個 leaf
- `useTabletPortraitMode()` hook（組合 `useTabletMode()` + orientation query）

## SlideOverPane 元件

- **位置**：`position: absolute; right: 0; top: 0; bottom: 0; width: 58%`
- **樣式**：`z-25`、`rounded-l-(--radius-card)`（12px）、`border-l border-border`、`shadow-floating`、`bg-surface`
- **進場**：`translateX(100%) → translateX(0)`，duration `--dur-drawer`（240ms）
- **退場**：反向動畫，完成後從 DOM 移除

## Touch Gesture

使用 pointer events（pointerdown / pointermove / pointerup）：

1. **右滑收回**：
   - pointerdown 記錄起始 x
   - pointermove 計算 deltaX > 0（右移）
   - deltaX > 100px 或 velocity > 0.5px/ms → 觸發收回（focusPane 到 main pane）
   - 滑動期間 slide-over 跟著 translateX(deltaX) 即時移動

2. **左拖釘選**：
   - pointermove 計算 deltaX < 0（左移）
   - deltaX < -100px → 觸發「釘選」提示（左緣出現 accent 指示線）
   - pointerup 時確認 → 呼叫 pane tree split（slide-over pane 變成永久 split leaf）

## Pane 渲染策略

在 slide-over mode 下，`TabContainer` 的 pane 渲染邏輯：
- 主 pane（非 focused 的第一個 leaf）：佔滿容器
- focused secondary pane：以 `<SlideOverPane>` overlay 渲染
- 其餘 pane：不渲染（保留在 tree 中）

判斷 focused pane 是否為 "secondary"：
```
const leaves = leafIdsInOrder(paneRoot)
const isSecondary = focusedPaneId !== leaves[0]
```

## 釘選（pin-to-split）

用 `splitPaneAndSetContent` 在主 pane 右側插入水平分割，退出 slide-over mode（因為有了永久雙 pane，tablet 橫向邏輯接手）。

## 不動的

- pane tree 結構（slide-over 只是渲染策略，不改 PaneNode）
- CondensedPaneStrip（tablet 橫向的直立 tab 條，共存）
- Zoom、Drawer、PanePicker 行為
