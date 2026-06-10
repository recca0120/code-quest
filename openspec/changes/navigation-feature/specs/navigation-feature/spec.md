## ADDED Requirements

### Requirement: NavigationFeature interface

`packages/client/src/lib/feature.ts` SHALL 匯出 interface `NavigationFeature extends ChannelFeature`，欄位：

| 欄位 | 型別 | 必填 |
|---|---|---|
| `navigation.category` | `string` | ✓ |
| `navigation.title` | `string` | ✓ |
| `navigation.subtitle` | `string` | — |
| `navigation.icon` | `React.ReactNode` | — |
| `navigation.sortKey` | `string \| number` | — |
| `navigate()` | `() => void` | ✓ |
| `match(query)` | `(q: string) => { score: number; highlights?: [number, number][] } \| null` | — |

同時匯出 `isNavigationFeature(f): f is NavigationFeature` type guard。

#### Scenario: Type guard narrows correctly

- **WHEN** 傳入 `{ id, navigation: {...}, navigate: () => {} }` 給 `isNavigationFeature`
- **THEN** 回 true

- **WHEN** 傳入 `{ id, menuItem: {...}, execute: () => {} }`
- **THEN** 回 false

### Requirement: messagesToNavigationFeatures adapter

純函式 `messagesToNavigationFeatures({ messages, visibility, onJump })` SHALL 回傳 `NavigationFeature[]`，每則可見訊息一個 feature。

Feature 內容：
- `id`：`msg-${message.id}`
- `navigation.category`：`'message'`
- `navigation.title`：經過 preview 處理（截斷、去 ANSI、取首行）
- `navigation.subtitle`：role + typeLabel + 時間
- `navigation.sortKey`：timestamp（由新到舊在 list 端決定）
- `navigate()`：呼叫 `onJump(message.id)`
- `match(query)`：query 為空時 `{ score: 0 }`；非空則對 `title` 做 case-insensitive substring 比對，match 則 `{ score: -matchIndex, highlights: [[start, end]] }`；不 match 則 `null`

#### Scenario: Filtered by visibility

- **WHEN** messages 中某訊息 `isMessageVisible(msg, visibility) === false`
- **THEN** 該訊息不在輸出陣列中

#### Scenario: Match returns correct highlights index

- **WHEN** title 為 `"Hello world, hello again"`、query `"hello"`（case-insensitive）
- **THEN** `match('hello')` 回傳 `{ score, highlights: [[0, 5]] }`（只回第一 match）
- **AND** `title.slice(0, 5) === "Hello"`

#### Scenario: Navigate calls onJump

- **WHEN** 呼叫 feature 的 `navigate()`
- **THEN** adapter 傳入的 `onJump(message.id)` 被呼叫一次

### Requirement: NavigationList component

`<NavigationList features query onSelect? className?>` SHALL：

1. 對每個 feature 呼叫 `match(query)`（無 match 函式則用預設 title-includes）
2. 過濾 null 結果
3. 依 `score` 降冪排序（tie by index）
4. 渲染每個 match 的 row：icon + title（highlights 高亮）+ subtitle
5. Row 點擊：呼叫 `onSelect?.(feature) ?? feature.navigate()`

#### Scenario: Empty query shows all visible features

- **WHEN** `query=""`、features 3 筆都回 `{ score: 0 }`
- **THEN** 渲染 3 個 row

#### Scenario: Query filters and sorts

- **WHEN** query `"foo"`、feature A match score -5、feature B match score -1、feature C `null`
- **THEN** 渲染 B, A 依序（C 不出現）

#### Scenario: Highlight spans rendered within title

- **WHEN** feature `match` 回 `highlights: [[2, 6]]`，title `"ab match ef"`
- **THEN** title 渲染為 3 段，index [2, 6) 範圍包在高亮元素中

#### Scenario: Row click triggers navigate

- **WHEN** row click、onSelect 未傳
- **THEN** `feature.navigate()` 呼叫一次

- **WHEN** row click、onSelect 有傳
- **THEN** `onSelect(feature)` 呼叫、`feature.navigate()` 不呼叫

### Requirement: message-preview utility

`utils/message-preview.ts` SHALL 匯出 pure helpers：`messagePreview(message)`, `highlightSegments(title, highlights)`, `typeColor(type)`, `typeLabel(type)`。這些原本內聯於 `CommandPalette.tsx`，抽出後行為不變。

#### Scenario: Import from utils works without React tree

- **WHEN** 單元測試 import 這些函式
- **THEN** 不需要 React provider 即可呼叫且回傳正確結果
