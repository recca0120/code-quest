# rail-decoupling Specification

## Purpose
TBD - created by archiving change rail-decoupling. Update Purpose after archive.
## Requirements
### Requirement: RightPane SHALL be rendered by SessionPane directly
SessionPane MUST render RightPane outside of ChannelProvider scope, in a flex row alongside TabContent.

#### Scenario: ChatView has no rightPane prop
- **WHEN** refactoring is complete
- **THEN** `ChatView` interface has no `rightPane` or `railWidth` prop
- **AND** `TabContent` interface has no `rightPane` or `railWidth` prop

#### Scenario: SessionPane renders rail wrapper
- **WHEN** rail.open is true and meta.cwd exists
- **THEN** SessionPane renders `data-testid="chat-rail-wrapper"` div as sibling of TabContent
- **AND** RightPane is NOT inside ChannelProvider

#### Scenario: visual layout unchanged
- **WHEN** rail is open
- **THEN** rail wrapper has `w-(--rail-w) shrink-0 border-l border-border-subtle overflow-y-auto`
- **AND** inline width style applied when railWidth is set

#### Scenario: rail collapse behavior unchanged
- **WHEN** pane width < 720px
- **THEN** rail auto-collapses (ResizeObserver)
- **AND** PaneDock appears at bottom

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

