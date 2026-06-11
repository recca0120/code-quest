## Why

Handoff §8 RWD 定案 mobile（<640）佈局有兩個缺失：
1. **頂列**：設計要求「tab 下拉 + pane 數字 ①②③ + ⊞ 切換器」，目前只有 MobilePaneWall 的 ⊞ 浮動按鈕，沒有頂列
2. **卡片牆 preview**：MobilePaneWall 骨架有了（2 欄 grid + accent 框），但卡片內沒有 pane 內容縮影，只顯示文字 label

## What Changes

### B2: Mobile 頂列（MobileTopBar）
- 固定在視窗頂部，高 44px（hit-min）
- 左：workspace tab 下拉選擇器（當前 tab 名 + ▾）
- 中：pane 編號 dots ①②③（22px），點擊切換 pane
- 右：⊞ 按鈕開啟卡片牆

### B3: 卡片牆 Preview 縮影
- 每張卡片顯示 pane 內容的靜態縮影（截斷前幾行文字 / 類型 icon）
- chat pane：最後一則訊息 preview
- tool pane（files/git/spec）：類型 icon + cwd basename
- 新增「＋」卡片開 picker 新增 pane

## Scope

- MobileTopBar 元件（tab dropdown + pane dots + ⊞）
- MobilePaneWall 卡片增強（preview content + ＋ 新增卡）
- 與現有 `useMobileMode()` hook 整合

## Out of Scope

- 左右滑切 pane 手勢（可獨立）
- Bottom sheet drawer（已實作）
- Composer 16px 防縮放（已實作）
