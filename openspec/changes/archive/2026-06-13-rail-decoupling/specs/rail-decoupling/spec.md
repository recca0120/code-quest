## ADDED Requirements

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
