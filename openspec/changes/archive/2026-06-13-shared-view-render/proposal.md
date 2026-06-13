## Why

三處各自 mount 相同的 view 元件（GitView / FilesView / SpecView）：
1. `tool-panes.tsx` 的 `createToolPane({ renderView })`
2. `RightPane` 的 TabContent 裡各自寫 `<GitView>` / `<FilesView>` / `<SpecView>`
3. `DrawerHost` 的 `renderDrawerBody(content)`

新增 view 類型時要改三處。抽共用函式後只改一處。

屬於主 change `workspace-structure-refactor` 的 Phase 1 子 change。

## What Changes

抽 `renderPaneView(type, cwd)` 共用函式，三處全部改呼叫它。

## Capabilities

### New Capabilities
- `pane-view-render`: 共用 renderPaneView 函式

### Modified Capabilities

## Impact

- `apps/web/src/components/workspace/pane-view-render.tsx` (新檔)
- `apps/web/src/components/workspace/panes/tool-panes.tsx` — 改用共用函式
- `apps/web/src/components/workspace/RightPane.tsx` — 改用共用函式
- `apps/web/src/components/workspace/DrawerHost.tsx` — 改用共用函式
