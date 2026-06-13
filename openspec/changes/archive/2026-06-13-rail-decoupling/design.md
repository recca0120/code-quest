## Context

目前 rail 佈局路徑：
```
SessionPane → TabContent(rightPane={<RightPane/>}, railWidth) → ChatView(rightPane, railWidth)
  ChatView 內: <div flex> <ChatShell/> {rightPane && <div rail-wrapper>{rightPane}</div>} </div>
```

問題：
1. ChatView 不該管佈局（它是 chat 邏輯元件）
2. RightPane 被包在 ChannelProvider scope 裡（不需要 channel context）
3. rightPane/railWidth 穿透兩層 props

## Goals / Non-Goals

**Goals:**
- RightPane 從 ChannelProvider 外部渲染
- ChatView/TabContent 移除 rightPane/railWidth props
- 視覺佈局（rail wrapper DOM）完全不變
- rail resize/collapse 行為不變

**Non-Goals:**
- 不改 RightPane 元件本身
- 不改 PaneDock（收合時的底部 dock）
- 不改 rail state 管理邏輯（已在 SessionPane）

## Decisions

### Rail wrapper 搬到 SessionPane

SessionPane PaneShell body 內做 flex row 分割：

```tsx
<div className="flex flex-1 min-h-0">
  <div className="flex-1 min-h-0 flex flex-col">
    <TabContent channelId={...} cwd={...} ... />  {/* 不再傳 rightPane/railWidth */}
  </div>
  {rail.open && meta.cwd && (
    <div data-testid="chat-rail-wrapper" className="w-(--rail-w) shrink-0 border-l border-border-subtle overflow-y-auto"
         style={railWidth !== undefined ? { width: railWidth } : undefined}>
      <RightPane ... />
    </div>
  )}
</div>
```

### ChatView 變成純 chat

ChatView 只負責 ChatShell + MessageList + ChatInputArea。不接受任何佈局 prop。

### TabContent 介面精簡

移除 `rightPane` 和 `railWidth` props。只保留 channelId, cwd, branch, mode, onNewChannel。

## Risks / Trade-offs

- 中風險：SessionPane 結構調整較大，但既有測試覆蓋 rail 行為
- RightPane 移出 ChannelProvider scope — 確認 RightPane 不依賴 channel context（它用 cwd prop）
