# pane-view-render Specification

## Purpose
TBD - created by archiving change shared-view-render. Update Purpose after archive.
## Requirements
### Requirement: renderPaneView shared function
系統 SHALL 提供 `renderPaneView(type, cwd)` 函式，回傳對應的 view ReactNode。

#### Scenario: git type 回傳 GitView
- **WHEN** `renderPaneView('git', '/path')`
- **THEN** 回傳 `<GitView cwd="/path" />`

#### Scenario: files type 回傳 FilesView
- **WHEN** `renderPaneView('files', '/path')`
- **THEN** 回傳 `<FilesView cwd="/path" />`

#### Scenario: openspec type 回傳 SpecView
- **WHEN** `renderPaneView('openspec', '/path')`
- **THEN** 回傳 `<SpecView cwd="/path" />`

### Requirement: tool-panes and DrawerHost MUST use renderPaneView
`tool-panes.tsx` 和 `DrawerHost.tsx` MUST 改用 `renderPaneView` 取代各自內嵌的 view 渲染。

#### Scenario: tool-panes 使用共用函式
- **WHEN** GitPane / FilesPane / OpenspecPane 渲染 body
- **THEN** 其 `renderView` 呼叫 `renderPaneView`

#### Scenario: DrawerHost 使用共用函式
- **WHEN** DrawerHost 渲染 drawer body
- **THEN** 呼叫 `renderPaneView` 取代 `renderDrawerBody`

