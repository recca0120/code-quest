## Why

RightPane 目前透過 prop 穿過 SessionPane → TabContent → ChatView 三層傳遞。這使 ChatView 承擔了佈局職責（rail wrapper 的 flex 分割），且 RightPane 被包在 ChannelProvider scope 裡（不必要）。

屬於主 change `workspace-structure-refactor` 的 Phase 2 子 change。

## What Changes

將 RightPane 從 TabContent/ChatView 的 prop 移出，改由 SessionPane 直接在 PaneShell body 做 flex 分割（左 TabContent、右 RightPane）。ChatView 和 TabContent 移除 rightPane/railWidth props。

## Capabilities

### Modified Capabilities
- `session-pane`: SessionPane 直接管理 rail layout
- `chat-view`: ChatView 移除 rightPane/railWidth props
- `tab-content`: TabContent 移除 rightPane/railWidth props

## Impact

- `apps/web/src/components/workspace/panes/SessionPane.tsx` — rail wrapper 移到此處
- `apps/web/src/components/workspace/TabContent.tsx` — 移除 rightPane/railWidth props
- `apps/web/src/components/chat/ChatView.tsx` — 移除 rightPane/railWidth props, rail wrapper
