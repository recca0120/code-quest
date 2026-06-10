## 1. Interface + type guard（TDD）

- [ ] 1.1 寫 `lib/__tests__/feature.test.ts`（或擴充既有）：`isNavigationFeature` true/false 分支
- [ ] 1.2 在 `lib/feature.ts` 新增 `NavigationFeature` interface 與 `isNavigationFeature` guard
- [ ] 1.3 `pnpm typecheck` clean

## 2. message-preview utility 搬家

- [ ] 2.1 寫 `utils/__tests__/message-preview.test.ts`：`messagePreview`、`highlightSegments`、`typeColor`、`typeLabel`
- [ ] 2.2 新增 `utils/message-preview.ts`（從 CommandPalette 搬出）
- [ ] 2.3 CommandPalette 暫不動；utils 由新 adapter 先吃

## 3. messagesToNavigationFeatures adapter（TDD）

- [ ] 3.1 寫 `features/navigation/__tests__/messages-navigation.test.ts`：
  - visibility 過濾
  - navigate 呼叫 onJump
  - match 空 query 回 score 0
  - match 非空 query 回 highlights 正確 index
  - 不 match 回 null
- [ ] 3.2 實作 `features/navigation/messages-navigation.ts`

## 4. NavigationList 元件（TDD）

- [ ] 4.1 寫 `components/navigation/__tests__/NavigationList.test.tsx`：
  - empty query 顯示全部
  - 過濾 + 排序依 score
  - highlight 區段渲染正確
  - click 觸發 navigate / onSelect
- [ ] 4.2 實作 `components/navigation/navigation-parts.tsx`（NavigationRow + 高亮片段渲染）
- [ ] 4.3 實作 `components/navigation/NavigationList.tsx`
- [ ] 4.4 加 `NavigationList.stories.tsx`（Empty, WithResults, Highlighted, MultiCategory）

## 5. CommandPalette Messages tab 切換

- [ ] 5.1 `CommandPalette.tsx` 呼叫 `messagesToNavigationFeatures`、Messages tab 渲染改 `<NavigationList />`
- [ ] 5.2 jump-to-message：onSelect 先 `onClose()`、再 requestAnimationFrame 做 scroll
- [ ] 5.3 既有 CommandPalette tests：必要時改 selector（不改 scenario 語意）

## 6. CommandPalette All tab 切換

- [ ] 6.1 All tab 改為 `<FeatureList />`（actions）+ section header + `<NavigationList />`（messages）
- [ ] 6.2 search query 統一傳給 NavigationList；actions 段仍走 palette 自身 label 過濾（如既有）

## 7. 清理內聯 util

- [ ] 7.1 刪除 CommandPalette 中已搬到 utils 的 helper 函式（或改 import）
- [ ] 7.2 確認無 dead code

## 8. 整合驗證

- [ ] 8.1 `pnpm -C packages/client test` 全綠
- [ ] 8.2 `pnpm -C packages/client` typecheck clean
- [ ] 8.3 `pnpm -C packages/client test-storybook:ci` suites ≥ 97
- [ ] 8.4 biome lint clean（新檔）
- [ ] 8.5 手動 smoke：Cmd+K 開 palette → Messages tab 搜尋 + 點訊息跳轉；All tab 兩段皆正常
- [ ] 8.6 commit
