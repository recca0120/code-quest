## Context

三處各自 mount view：
- `tool-panes.tsx`: `renderView: (cwd) => <GitView cwd={cwd} />`
- `RightPane`: `<GitView cwd={cwd} />` 直接在 TabContent 裡
- `DrawerHost`: `renderDrawerBody(content)` switch on content.type

## Goals / Non-Goals

**Goals:**
- 一個共用函式取代三處重複
- DOM 輸出完全不變

**Non-Goals:**
- 不改變 view 元件本身
- 不改變 tool-panes 的 `createToolPane` factory pattern（只替換 renderView callback）

## Decisions

### renderPaneView 函式

```tsx
function renderPaneView(type: 'git' | 'files' | 'openspec', cwd: string): React.ReactNode
```

放在 `apps/web/src/components/workspace/pane-view-render.tsx`。

### RightPane 的 onMention

RightPane 的 FilesView 有額外的 `onMention` prop。`renderPaneView` 不處理這個 — RightPane 保留自己的 `<FilesView cwd={cwd} onMention={onMention} />`，只有 git 和 spec 走共用函式。

或者更簡單：`renderPaneView` 接受 optional `onMention` 參數，在 files 時傳入。

決策：**不傳 onMention**。RightPane 本來就是三個獨立的 TabContent，只合併 git 和 spec 的 rendering 沒意義。所以 `renderPaneView` 只用在 tool-panes 和 DrawerHost 這兩處（它們都不需要 onMention）。RightPane 保持原樣。

## Risks / Trade-offs

- 極低風險：純函式抽取
- RightPane 不使用共用函式是刻意的（它有 onMention 等額外 prop）
