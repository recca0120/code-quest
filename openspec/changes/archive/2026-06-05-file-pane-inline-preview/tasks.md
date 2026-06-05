## 1. PreviewDrawer — 純 UI component

- [x] 1.1 新增 `PreviewDrawer.tsx`（Radix Dialog，接受 `state: PreviewState` prop，不含 RPC）
- [x] 1.2 新增 `__tests__/PreviewDrawer.test.tsx`（直接傳 state prop，不需 fake socket）
- [x] 1.3 在 PreviewDrawer 加入 resize handle（左側拖曳調整寬度，pointer events 手刻）
- [x] 1.4 PreviewDrawer 支援 `actions?: ReactNode` prop（footer 動作按鈕由呼叫者決定）

## 2. FilesPane 整合

- [x] 2.1 `FilesPane.tsx` 承接 RPC fetch 邏輯（管理 previewState），改用 `PreviewDrawer`
- [x] 2.2 FilesPane 自行組裝 actions（Mention + Copy path 按鈕）
- [x] 2.3 更新 `__tests__/FilesPane.test.tsx`

## 3. 清理

- [x] 3.1 刪除 `FilePreviewDrawer.tsx` 與 `__tests__/FilePreviewDrawer.test.tsx`

## 4. PdfViewer 修正（已完成）

- [x] 4.1 blob URL 改用 `useState` + `useEffect`（修正 Strict Mode revocation）
- [x] 4.2 PDF parent 移除 `overflow-auto`（修正初始寬度跳動）
- [x] 4.3 `useLayoutEffect` 同步讀取初始 viewportRef 寬度
- [x] 4.4 更新 `__tests__/PdfViewer.test.tsx`（ResizeObserver mock）

## 5. fs:browse 回傳檔案大小，預讀判斷

- [x] 5.1 `packages/filesystem/src/types.ts`：`DirectoryEntry` 加 `size: number`（bytes）
- [x] 5.2 `packages/schemas/src/socket/fs.ts`：`fsFileSchema` 加 `size: z.number()`
- [x] 5.3 `packages/filesystem/src/local-filesystem.ts`：`readBrowseEntries` 對 files 呼叫 `stat()` 取得 size
- [x] 5.4 `apps/web/src/components/files/FileTree.tsx`：`onActivate` 改為傳 `EntryItem`（含 size）而非 `path: string`
- [x] 5.5 `apps/web/src/components/files/FilesPane.tsx`：`useEffect` 直接檢查 size；size > limit 設 `too-large` 不發 RPC
- [x] 5.6 更新相關測試（`FilesPane.test.tsx`、`FileTree.test.tsx`、`fake-filesystem.test.ts`）
