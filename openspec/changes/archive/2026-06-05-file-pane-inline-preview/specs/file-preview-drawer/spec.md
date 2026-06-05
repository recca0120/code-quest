## ADDED Requirements

### Requirement: Drawer opens on file click
點擊 FileTree 中的檔案，SHALL 從右側滑入 FilePreviewDrawer，FileTree 保持在 DOM 中（aria-hidden 但未移除）。

#### Scenario: Plain click opens drawer
- **WHEN** 使用者點擊 FileTree 中的檔案
- **THEN** FilePreviewDrawer 開啟，顯示該檔案的檔名與內容

#### Scenario: FileTree stays in DOM while drawer is open
- **WHEN** FilePreviewDrawer 開啟
- **THEN** FileTree 仍存在於 DOM（可透過 `{ hidden: true }` 查詢到）

#### Scenario: Cmd/Ctrl+click does not open drawer
- **WHEN** 使用者按住 Cmd/Ctrl 點擊檔案
- **THEN** 觸發 onMention，Drawer 不開啟

### Requirement: Drawer dismissal
使用者 SHALL 能透過 Escape 鍵或點擊 overlay 關閉 Drawer。

#### Scenario: Escape closes drawer
- **WHEN** Drawer 開啟時按下 Escape
- **THEN** Drawer 關閉，FileTree 恢復正常互動狀態

#### Scenario: Overlay click closes drawer
- **WHEN** Drawer 開啟時點擊 overlay
- **THEN** Drawer 關閉

### Requirement: File content rendering
FilePreviewDrawer SHALL 根據檔案類型選擇適當的渲染方式。

#### Scenario: Plain text file
- **WHEN** 開啟純文字檔案
- **THEN** 以行號表格顯示內容

#### Scenario: Code file
- **WHEN** 開啟程式碼檔案（如 .ts、.tsx）
- **THEN** 以語法高亮顯示內容

#### Scenario: Markdown file default view
- **WHEN** 開啟 Markdown 檔案
- **THEN** 預設顯示渲染後的 HTML，並提供 Preview / Raw 切換按鈕

#### Scenario: PDF file
- **WHEN** 開啟 PDF 檔案
- **THEN** 使用 PdfViewer 渲染，不在 PDF parent 加 overflow-auto

#### Scenario: Image file
- **WHEN** 開啟圖片檔案
- **THEN** 顯示 `<img>` 元素，src 為 base64 data URL

#### Scenario: File not found
- **WHEN** 開啟不存在的檔案
- **THEN** 顯示錯誤訊息

### Requirement: Drawer actions
FilePreviewDrawer SHALL 提供 Mention 與 Copy path 操作。

#### Scenario: Mention button
- **WHEN** 點擊 Mention 按鈕
- **THEN** 呼叫 onMention(path)

#### Scenario: Copy path button
- **WHEN** 點擊 Copy path 按鈕
- **THEN** 將完整路徑寫入剪貼簿

### Requirement: Drawer resizable width
使用者 SHALL 能透過拖曳 resize handle 調整 Drawer 寬度。

#### Scenario: Drag handle exists
- **WHEN** Drawer 開啟
- **THEN** 左側有可見的 resize handle

#### Scenario: Width has minimum constraint
- **WHEN** 使用者向右拖曳 resize handle 超過最小寬度
- **THEN** Drawer 寬度不小於設定的最小值

#### Scenario: Width has maximum constraint
- **WHEN** 使用者向左拖曳 resize handle 超過最大寬度
- **THEN** Drawer 寬度不超過設定的最大值
