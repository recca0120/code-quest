## 1. DiffDrawer — TDD

- [x] 1.1 新增 `DiffDrawer.test.tsx`：測試 drawer 開啟顯示 diff 行、binary 訊息、truncation 警告
- [x] 1.2 新增 `DiffDrawer.test.tsx`：測試 Copy-path 按鈕、Discard 二次確認流程、untracked 時 disabled
- [x] 1.3 實作 `DiffDrawer.tsx`：包 `RightDrawer`，渲染 diff 行列，footer 含 Copy-path 和 Discard
- [x] 1.4 確認 `DiffDrawer` tests 全綠

## 2. GitPane 替換

- [x] 2.1 更新 `GitPane.tsx`：將 `DiffModal` 換成 `DiffDrawer`，`open={!!diffFile}`
- [x] 2.2 更新 `GitPane.test.tsx`：替換 DiffModal 相關測試為 DiffDrawer（drawer 開關、Copy-path、Discard）
- [x] 2.3 確認 `GitPane` tests 全綠

## 3. 清除 DiffModal

- [x] 3.1 刪除 `DiffModal.tsx`
- [x] 3.2 刪除 `DiffModal.test.tsx`（若存在）
- [x] 3.3 執行完整測試套件，確認全綠
