## Why

Design 行為審計發現 8 項快速可修的行為不一致。這些是元件層邏輯修正，不需新增元件或大重構。

## What Changes

### 1. ⌘K 鍵帽可點擊（TabBar）
- 現狀：`<span aria-hidden>` 靜態裝飾
- 目標：點擊開 PanePicker（與鍵盤 ⌘K 同行為）

### 2. ⚙ 按鈕常駐（TabBar）
- 現狀：`onOpenSettings` prop 不傳時不渲染
- 目標：永遠顯示，無 handler 時 disabled 或 noop

### 3. Tab 去前綴邏輯（TabBar）
- 現狀：`split('/').at(-1)` 只取最後段，多層路徑丟中間段
- 目標：只去第一段類型前綴（feat/fix/chore/等），保留其餘

### 4. PanePicker 開啟預設聚焦欄（PanePicker）
- 現狀：開啟時 `setCol(2)` 聚焦欄3
- 目標：開啟時聚焦欄1（Projects）或保持智慧預設

### 5. ⏎ 在欄1/2 的 guard（PanePicker）
- 現狀：欄1/2 按 ⏎ 誤觸 contentItems[0]=chat
- 目標：欄1/2 時 ⏎ 不執行（或移動到下一欄）

### 6. Mobile ⊞ 單 pane guard（MobilePaneWall）
- 現狀：`leaves.length < 2` 時 return null，⊞ 點無反應
- 目標：單 pane 時 ⊞ 開 PanePicker（而非卡片牆）

### 7. font-size statusline 短暫提示（偏好三軸）
- 現狀：⌘=/⌘-/⌘0 切換後無視覺回饋
- 目標：statusline 短暫顯示目前字級（如 toast 或暫態文字）

### 8. Tablet portrait 3+ pane condensed strip（RWD）
- 現狀：portrait 模式 CondensedPaneStrip 不渲染
- 目標：portrait 下 3+ pane 時渲染 condensed strip（第三個以後收納）

## Out of Scope
- diff/terminal pane types（獨立 change）
- fuzzy filter + 命中高亮（feature change）
- mobile 底部 dock chips（feature change）
- font-size 循環 vs 停住（需確認設計意圖）
- 斷點 640 vs 768（已定案 768）
- ⌘⌥Arrow 額外功能（不影響設計行為）
