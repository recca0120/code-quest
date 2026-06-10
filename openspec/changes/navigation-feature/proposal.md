## Why

`command-registry-unification` 已讓 CommandPalette 的 Actions tab 走 feature registry；但 Messages tab 仍把訊息瀏覽邏輯（filter / preview / highlight / scroll-to）寫死在 `CommandPalette.tsx`。這讓未來「加檔案/sessions 搜尋」變成要改 `CommandPalette`，而非加 adapter。`MenuItemFeature` 又不適合承載訊息（`section` / `label` 語意不合、跳轉不是 execute）。本 change 引入第三個 feature 類型 `NavigationFeature`，代表「可導航的內容項」，並把 Messages tab 重寫成 `NavigationList` 的 caller。

## What Changes

- 新增 interface `NavigationFeature`（與 `MenuItemFeature` / `SlashCommandFeature` 並列）：
  ```ts
  interface NavigationFeature extends ChannelFeature {
    navigation: { category, title, subtitle?, icon?, sortKey? };
    navigate(): void;
    match?(query: string): { score: number; highlights?: Array<[number, number]> } | null;
  }
  ```
- 新增 type guard `isNavigationFeature`
- 新增純 adapter `messagesToNavigationFeatures(messages, visibility, onJump)`：把訊息轉成 `NavigationFeature[]`，`navigate()` = 跳轉、`match()` = 模糊比對 + highlights
- 新增 `<NavigationList features query onSelect />` component：
  - 跟 `FeatureList` 平行
  - 套用 `feature.match(query)` 過濾與排序
  - 依 `highlights` 高亮 title 區段
  - 點選呼叫 `onSelect(feature)` 預設 `feature.navigate()`
- `CommandPalette.tsx` 的 Messages tab 改用 `<NavigationList>`；相關工具（`highlight`、`messagePreview`、`typeColor`、`typeLabel`）搬到 `utils/message-preview.ts`
- `CommandPalette.tsx` 的 `'all'` tab 以 `<NavigationList>` + `<FeatureList>` 組合（視覺接近現狀）
- **不動** `MenuItemFeature` / `SlashCommandFeature` / `FeatureRegistry`

## Capabilities

### New Capabilities

- `navigation-feature`: 新的 feature 類型 + 渲染元件 + adapter 模式，為 CommandPalette / 未來全域搜尋的內容導航提供統一介面

### Modified Capabilities

- `command-menu-structure`: CommandPalette 的 Messages tab 與 All tab 改由 NavigationFeature adapter 驅動，pallete 元件從 ~300 行降至 orchestrator 角色

## Impact

- 新增：
  - `packages/client/src/lib/feature.ts`（加 `NavigationFeature` + `isNavigationFeature`）
  - `packages/client/src/components/navigation/NavigationList.tsx`（+ test + story）
  - `packages/client/src/components/navigation/navigation-parts.tsx`（NavigationRow + 高亮渲染）
  - `packages/client/src/features/navigation/messages-navigation.ts`（adapter + test）
  - `packages/client/src/utils/message-preview.ts`（從 CommandPalette 搬出）
- 修改：
  - `packages/client/src/components/CommandPalette.tsx`（Messages/All tab 改用 NavigationList；刪除內聯渲染邏輯）
  - 既有 `CommandPalette` 相關 tests 可能需要調整 selector（DOM 結構會變）
- 風險：
  - Messages tab 的 filter / scroll-to-message / keyboard navigation 等整合行為在重寫時可能漂移 → Storybook 視覺對比 + 原有測試（改 selector 但不改 expects 語意）把關
  - `match` 回 `highlights` 的實作：訊息 preview 經過 strip/trim，原字串 index 與 preview index 不一致 → adapter 要回「preview 文本本身 + highlights on preview」，不是原訊息
