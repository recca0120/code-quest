## Context

目前 pane 的 toolbar 分兩層：
- `PaneHeader`：split/close/DnD，由 TabContainer 渲染
- `ToolPaneHeader`：emoji + label + worktree switcher，由 ToolPanes.tsx wrapper 渲染

導致 `ToolPanes.tsx` 必須維護三個幾乎相同的 wrapper（`GitPane`、`FilesPane`、`SpecPane`），每個都只是 `ToolPaneHeader` + feature view 的組合。

## Goals / Non-Goals

**Goals:**
- 統一 toolbar 為單一 `Pane.Toolbar`（compound component slot）
- 消滅 `ToolPaneHeader` 和 `GitPane`/`FilesPane`/`SpecPane` wrapper
- `WorktreeSwitcher` 成為獨立 component，可插入 `Pane.Toolbar` slot

**Non-Goals:**
- `RightPane`（ChatView 側邊面板）不在本 change 範圍
- pane tree 資料結構（`PaneNode`/`PaneLeaf`/`PaneSplit`）不動
- named component / layout persistence 不在本 change 範圍

## Decisions

### 1. Pane compound component

```tsx
Pane              // 外層容器（flex col，flex-1）
Pane.Toolbar      // 固定 split/close/DnD + children slot
Pane.Content      // 內容容器（flex-1, overflow-auto）
```

`Pane.Toolbar` 的 children 是 custom tools slot，worktree switcher 等插進來。
`PaneHeader` 合進 `Pane.Toolbar`，刪除 `PaneHeader.tsx`。

**testid 相容性**：`Pane.Toolbar` 的根元素沿用 `data-testid="pane-header"`，按鈕沿用 `data-testid="pane-split-h"`、`data-testid="pane-split-v"`、`data-testid="pane-close"`。這樣 `TabContainer.test.tsx` 零修改。

### 2. WorktreeSwitcher 獨立 component

從 `ToolPaneHeader` 拆出，props：`cwd`, `paneId`, `availableWorktrees`, `makeContent`。
`ToolPaneHeader` 整個刪除。

### 3. TabContainer 直接組合

```tsx
// 取代原本 <GitPane cwd={...} paneId={...} availableWorktrees={...} />
<Pane paneId={node.id} ...splitProps>
  <Pane.Toolbar>
    <WorktreeSwitcher
      emoji="🌿" label="Git"
      cwd={node.content.cwd}
      paneId={node.id}
      availableWorktrees={availableWorktrees}
      makeContent={(c) => ({ type: 'git', cwd: c })}
    />
  </Pane.Toolbar>
  <Pane.Content>
    <GitView cwd={node.content.cwd} />
  </Pane.Content>
</Pane>
```

session pane 的 `Pane.Toolbar` 不傳 children（只有 split/close/DnD）。

### 4. WorktreesPane 保留在 ToolPanes.tsx

`WorktreesPane` 結構不同（無 toolbar），暫不動，待 RightPane 一起討論。

## Risks / Trade-offs

- `PaneHeader.test.tsx` → `Pane.test.tsx`：進入點改為 `<Pane.Toolbar>`，所有 expect 不動（testid 沿用）
- `ToolPaneHeader.test.tsx` → `WorktreeSwitcher.test.tsx`：T.4 兩個 textContent expect 從抓 container 改為抓按鈕本身，其餘不動
- `TabContainer.test.tsx`：零修改，production code 維持相同 testid 即可
- TabContainer 的 render 邏輯會變長，但結構更清楚（直接看到每個 content type 的組合）
