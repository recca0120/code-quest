# bottom-sheet Specification

## Purpose
TBD - created by archiving change sidebar-navigation-redesign. Update Purpose after archive.
## Requirements
### Requirement: BottomSheet 基礎元件

系統 SHALL 提供 `BottomSheet` component，在 mobile/tablet viewport 上呈現 action sheet，作為 Dropdown menu 的替換呈現層。

#### Scenario: 顯示與關閉
- **WHEN** `open` prop 為 `true`
- **THEN** BottomSheet 從螢幕底部出現，overlay 覆蓋背景
- **WHEN** 使用者點擊 overlay
- **THEN** BottomSheet 關閉（呼叫 `onClose`）

#### Scenario: 標題與內容
- **WHEN** 傳入 `title` prop
- **THEN** sheet 頂部顯示標題文字
- **WHEN** 傳入 `children`
- **THEN** children 渲染在標題下方的 action list 區域

#### Scenario: Drag handle 視覺
- **WHEN** BottomSheet 開啟
- **THEN** 頂部顯示 drag handle bar（純視覺裝飾，不實作拖曳手勢）

#### Scenario: Accessibility
- **WHEN** BottomSheet 開啟
- **THEN** focus 移至 sheet 內部
- **WHEN** 使用者按 Escape
- **THEN** BottomSheet 關閉

---

### Requirement: BottomSheet action item

`BottomSheet` SHALL 提供 `BottomSheetItem` component，用於呈現單一操作選項。

#### Scenario: 點擊觸發 callback
- **WHEN** 使用者點擊 `BottomSheetItem`
- **THEN** 呼叫 `onClick` callback，並關閉 BottomSheet

#### Scenario: Destructive variant
- **WHEN** `variant="destructive"` 時
- **THEN** item 文字以 danger 色顯示

