## Why

原本點擊檔案會彈出 Modal，遮住整個畫面、無法對照 FileTree，也不適合快速瀏覽多個檔案。改用從右側滑入的 Drawer，FileTree 保持可見，並支援拖曳調整 Drawer 寬度，讓使用者自由決定預覽空間的大小。

## What Changes

- 新增 `FilePreviewDrawer` 元件：Radix Dialog 實作，從右側滑入，支援 PDF（PdfViewer）、Image、Markdown（Preview/Raw 切換）、Code、Plain text
- `FilesPane` 改用 `FilePreviewDrawer` 取代原有的 `FilePreviewModal`（FileTree 保持在 DOM）
- Drawer 支援拖曳 resize（使用 `react-resizable-panels`），使用者可調整預覽寬度，有 min/max 限制
- Escape / 點 overlay 可關閉 Drawer
- 修正 `PdfViewer` 在 Strict Mode 下 blob URL 被提前 revoke 的問題（`useMemo` → `useState` + `useEffect`）
- 修正 `PdfViewer` 初始寬度跳動問題：PDF parent 不再有 `overflow-auto`，用 `useLayoutEffect` 同步讀取初始寬度

## Capabilities

### New Capabilities

- `file-preview-drawer`：FileTree 保持可見的右側 Drawer 預覽，支援所有檔案類型，可拖曳調整寬度

### Modified Capabilities

（無 spec-level 需求異動）

## Impact

- `apps/web/src/components/files/FilesPane.tsx`：改用 FilePreviewDrawer
- `apps/web/src/components/files/FilePreviewDrawer.tsx`：新增，加入 resize handle
- `apps/web/src/components/files/PdfViewer.tsx`：修正 blob URL 與初始寬度問題
- `apps/web/src/components/files/__tests__/`：對應測試
- 依賴：`react-resizable-panels`（已在 package.json）
