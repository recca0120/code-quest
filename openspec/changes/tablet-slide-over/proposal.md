## Why

Handoff §8 RWD 定案：tablet 直向（portrait）模式下，多 pane 應以 slide-over 浮層呈現，而非強制單欄。目前 `CondensedPaneStrip` 僅處理 tablet 橫向的直立 tab 條，直向的 slide-over 浮層完全未實作。

## What Changes

在 tablet portrait（寬 640–1024 且直向）模式下，第二個 pane 以右側 slide-over 浮層形式疊加在主 pane 上方：
- 浮層寬 58%、圓角 12、z-25
- 右滑手勢收回浮層
- 左拖到底可固定成永久分割（slide-over → pane split 轉換）
- 回桌面模式時自動還原為正常 pane tree 佈局

## Scope

- SlideOverPane 容器元件 + 進出場動效（240ms slide）
- tablet portrait 斷點偵測（orientation media query）
- pane tree 在 slide-over mode 下的渲染策略（主 pane 全寬 + focused secondary pane 以 overlay 顯示）
- touch gesture handler（pointer events：右滑關閉、左拖釘選）
- slide-over → permanent split 轉換（修改 pane tree 結構）
- 與 zoom、close、split 的互動整合

## Out of Scope

- Mobile（<640）佈局（另有 mobile-rwd-polish change）
- Drawer bottom sheet（已實作）
- 拖曳重排（§7，獨立功能）
