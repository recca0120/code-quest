## Context

- `ChannelFeature` 是 base interface（只有 `id`），`MenuItemFeature` / `SlashCommandFeature` 是其子型
- CommandPalette 目前 Messages tab 內聯：`messagePreview`、`highlight`、`typeColor`、`typeLabel`、filter by `isMessageVisible`、search by includes、click → scroll
- FeatureList 已做好但只吃 `MenuItemFeature[]`，不適合訊息

## Goals / Non-Goals

**Goals**
- 訊息瀏覽邏輯 = adapter + 通用 list 元件（純 data 變純 UI）
- 新 `NavigationFeature` 結構夠一般化以容納未來檔案/sessions
- CommandPalette.tsx 從「訊息 + actions」雙重職責退回「tab orchestrator」

**Non-Goals**
- 不統一 feature interfaces（MenuItemFeature / SlashCommandFeature 不動）
- 不改 Actions tab（已走 FeatureList）
- 不改 search input / tab 切換 / 鍵盤快捷
- 不做檔案 / sessions 的 adapter（只示範訊息，驗證模式）

## Decisions

### D1. `match` 回 `{ score, highlights? }` 而非 boolean

```ts
match?(query: string): { score: number; highlights?: [number, number][] } | null;
```

- `null` = 不 match（過濾掉）
- `score` 用於排序（大的先）；不實作 `match` 時 list 走預設 `title.toLowerCase().includes(q)`
- `highlights` 是 `[start, end]` on the `navigation.title`，讓 UI 高亮

**替代**：boolean → 失去排序能力；回 pre-split segments → JSON-unfriendly 且破壞 i18n 再處理

### D2. `navigation.title` = 已經是 preview 過的字串

Adapter 負責把 `message.content` 轉成顯示字串（截斷、取首行、strip ANSI 等），`title` 直接丟給 UI 渲染。`highlights` 的 index 對應 `title` 本身，不需要反查原文。

**權衡**：失去「展示完整訊息」的彈性 → 若要完整顯示，用 `subtitle` 或開獨立預覽區

### D3. `navigate()` 的責任切分

Adapter 收 `onJump(messageId)` callback，`navigate()` 呼叫它。callback 哪裡拿？從 CommandPalette 的 `scrollTo` 邏輯提取。Adapter 本身不知道 DOM。

### D4. `NavigationList` vs `FeatureList` 為什麼不合併

| 欄位 | FeatureList | NavigationList |
|---|---|---|
| Section 分組 | ✓（`menuItem.section`） | ✗（扁平 list） |
| 排序 | order asc | match score desc |
| 搜尋 | 外部過濾 | 內部 `feature.match(query)` |
| highlight | 無 | title 高亮 |
| onClick | `execute()` + onItemClick | `navigate()` + onSelect |
| trailing | JSX | `icon` + `subtitle` 固定結構 |

形狀差異夠大，合併會讓兩邊都需要很多 prop，得不償失。共用只在底層 `<Row>` 視覺風格（若有共通可抽），不強求。

### D5. CommandPalette `all` tab 的組裝

```tsx
<div>
  <SectionHeader>Actions</SectionHeader>
  <FeatureList features={actionFeatures} />
  <SectionHeader>Messages</SectionHeader>
  <NavigationList features={messageFeatures} query={q} onSelect={...} />
</div>
```

- `all` tab 全域 search：把 query 傳給 `NavigationList`；`FeatureList` 用 menu item label 過濾（CommandPalette 已有邏輯可保留）
- 差別於 Messages tab 只顯示訊息、Actions tab 只顯示 actions、All tab 兩者都顯示

## Risks / Trade-offs

- **Preview 產生的 highlights 可能錯位**（例如訊息含換行、trim 後 index 位移）→ adapter 單元測驗：特定 preview 輸入、指定 query，驗證 `highlights` index 對應 `title[start:end]` 確實是 query substring
- **Scroll-to-message 可能被 palette 關閉 race**（palette close → DOM unmount → scroll 找不到目標）→ 先 close palette、再 requestAnimationFrame 內 scroll
- **既有 CommandPalette 測試依賴內聯 DOM 結構** → 容許調整 selector，不改 scenario 語意
- **訊息量大時 match 每次跑 O(n)** → 不預先 index；超 1000 則可加 `useMemo`；目前會話不會這麼多

## Migration Plan

1. 先做**無副作用的增量**：interface + adapter + NavigationList + story/test，完全不動 CommandPalette
2. 跑 vitest / storybook 確認新元件綠
3. CommandPalette Messages tab 切換（保留 All/Actions tab 原行為）
4. CommandPalette All tab 重構
5. 刪除內聯 util，統一到 utils/message-preview

Rollback：步驟 3 爆了 revert 那個 commit，1-2 的新元件不受影響且可留給未來使用
