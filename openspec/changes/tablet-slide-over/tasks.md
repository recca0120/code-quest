# Tablet Slide-Over — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline＋priming＋UI 驅動＋多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. 斷點偵測

- [x] 1.1 [test] useTabletPortraitMode hook：tablet 寬 + portrait → true；landscape → false；desktop → false
- [x] 1.2 [impl] useTabletPortraitMode（組合 useTabletMode + matchMedia orientation:portrait）

## 2. SlideOverPane 容器

- [x] 2.1 [test] SlideOverPane 渲染：absolute 定位、寬 58%、z-25、圓角、進場動效 class
- [x] 2.2 [impl] SlideOverPane 元件 + CSS（translateX 進退場 240ms）

## 3. Pane 渲染策略

- [x] 3.1 [test] tablet portrait + ≥2 leaf → 主 pane 全寬 + focused secondary 以 SlideOverPane overlay
- [x] 3.2 [impl] TabContainer / PaneLayout 在 portrait mode 下的渲染分歧
- [x] 3.3 [test] focus 切回第一個 pane → slide-over 收回
- [x] 3.4 [impl] focusPane 觸發 slide-over 進退場

## 4. Touch gesture — 右滑收回

- [x] 4.1 [test] 右滑 > 100px → slide-over 收回（focus 回主 pane）
- [x] 4.2 [impl] pointer events handler（pointerdown/move/up + velocity）

## 5. Touch gesture — 左拖釘選

- [x] 5.1 [test] 左拖 > 100px + pointerup → pane tree 新增永久 split
- [x] 5.2 [impl] pin-to-split 轉換（splitPaneAndSetContent）

## 6. 收尾

- [x] 6.1 [test] zoom 時 slide-over 不顯示（zoom 優先）
- [x] 6.2 [verify] 全套綠 + 手動測試 tablet portrait 模擬
