## Why

目前每個 tool pane（Git/Files/Spec）有兩層 toolbar 疊在一起：
- `PaneHeader`（TabContainer 加）：split/close/DnD
- `ToolPaneHeader`（ToolPanes.tsx 加）：emoji + label + worktree switcher

職責分散在兩個 component，結構不一致，且 `ToolPanes.tsx` 的 wrapper（`GitPane`、`FilesPane`、`SpecPane`）只是為了拼湊這兩層而存在。

## What Changes

- 新增 `Pane` compound component（`Pane.Toolbar` + `Pane.Content`）
  - `Pane.Toolbar`：內建 split/close/DnD，接受 `children` slot 放 custom tools
  - `Pane.Content`：統一的內容容器
- 新增 `WorktreeSwitcher` 獨立 component（從 `ToolPaneHeader` 拆出）
- 移除 `PaneHeader`（合進 `Pane.Toolbar`）
- 移除 `ToolPaneHeader` 與 `ToolPanes.tsx` 的 `GitPane`/`FilesPane`/`SpecPane` wrapper
- `TabContainer` 直接用 `Pane` compound component 組合各 content type

## Capabilities

### New Capabilities
- `pane-compound-component`: Pane compound component with unified Toolbar + Content slots

### Modified Capabilities
- `split-pane`: SplitPane leaf rendering 改用 Pane compound component

## Impact

- `apps/web/src/components/workspace/PaneHeader.tsx` → 移除
- `apps/web/src/components/workspace/ToolPanes.tsx` → 移除 GitPane/FilesPane/SpecPane，保留 WorktreesPane
- `apps/web/src/components/workspace/TabContainer.tsx` → 改用 Pane compound component
- `apps/web/src/components/workspace/Pane.tsx` → 新增
- `apps/web/src/components/workspace/WorktreeSwitcher.tsx` → 新增
