## Why

`AppProviders` 目前是 8 層巢狀 JSX，每次新增/移除 Provider 要調整縮排，閱讀時需要逐層匹配開合標籤。用 `composeProviders` utility 把巢狀改為扁平陣列宣告，降低認知負擔。

屬於主 change `workspace-structure-refactor` 的 Phase 1 子 change。

## What Changes

1. 新增 `composeProviders` utility 函式
2. `App.tsx` 的 `AppProviders` 改用此 utility 宣告

## Capabilities

### New Capabilities
- `compose-providers`: composeProviders utility + AppProviders 改寫

### Modified Capabilities

## Impact

- `apps/web/src/utils/compose-providers.tsx` (新檔)
- `apps/web/src/App.tsx` — AppProviders 改寫
