## ADDED Requirements

### Requirement: 統一 view 渲染函式
建立共用的 `renderPaneView(type, cwd)` 函式，DrawerHost、RightPane、tool-panes 全部使用。

#### Scenario: tool-panes 使用共用函式
- **WHEN** GitPane / FilesPane / OpenspecPane 渲染 body
- **THEN** 呼叫 `renderPaneView(type, cwd)` 而非各自內嵌 JSX

#### Scenario: DrawerHost 使用共用函式
- **WHEN** DrawerHost 渲染 drawer body
- **THEN** 呼叫 `renderPaneView(type, cwd)` 取代 `renderDrawerBody(content)`

#### Scenario: RightPane 使用共用函式
- **WHEN** RightPane 渲染分頁內容
- **THEN** 呼叫 `renderPaneView(type, cwd)` 取代各自的 `<GitView>` / `<FilesView>` / `<SpecView>`

#### Scenario: 渲染結果不變
- **WHEN** 同樣的 type + cwd 輸入
- **THEN** 重構前後產出的 DOM 完全相��
