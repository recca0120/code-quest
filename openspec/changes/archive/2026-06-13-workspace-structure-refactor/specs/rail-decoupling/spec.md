## ADDED Requirements

### Requirement: RightPane 從 ChatView 移出
RightPane 不再作為 ChatView 的 child 渲染，改由 SessionPane 直接管理。

#### Scenario: ChatView 無 rightPane prop
- **WHEN** 重構完成
- **THEN** `ChatView` 和 `TabContent` 不再有 `rightPane` prop
- **AND** `ChatView` 不再有 `railWidth` prop

#### Scenario: SessionPane 直接渲染 rail
- **WHEN** session pane 有 rail.open = true
- **THEN** SessionPane 在 PaneShell body 內做 flex 分割：左 TabContent、右 RightPane
- **AND** RightPane 不在 ChannelProvider scope 內

#### Scenario: 視覺佈局不變
- **WHEN** rail 展開
- **THEN** rail wrapper 的 DOM 結構維持 `<div shrink-0 border-l w-(--rail-w)>`
- **AND** rail 寬度（drag/persist）行為不變

#### Scenario: rail 收合行為不變
- **WHEN** pane 寬度 < 720px
- **THEN** rail 自動收合成 dock
- **AND** dock 點擊展開 rail

#### Scenario: rail 內的 drawer/promote 功能不變
- **WHEN** rail 內點 ⤢ 或 ⌘⏎
- **THEN** 仍能正確開 drawer 或升級成獨立 pane
