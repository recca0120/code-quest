## ADDED Requirements

### Requirement: CommandPalette Messages tab uses NavigationList

`CommandPalette` 的 `messages` tab SHALL 呼叫 `messagesToNavigationFeatures(...)` 產生 features，並以 `<NavigationList features={...} query={searchQuery} onSelect={...} />` 渲染，不再內聯 preview / highlight / filter 邏輯。

#### Scenario: Messages tab renders via NavigationList

- **WHEN** 切到 messages tab
- **THEN** DOM 中出現來自 `NavigationList` 的 rows（而非舊的內聯 row markup）
- **AND** 每 row 顯示 preview title + subtitle

#### Scenario: Search in messages tab uses feature.match

- **WHEN** 在 messages tab 輸入 search query
- **THEN** 不 match 的訊息不出現
- **AND** match 的訊息 title 對應區段高亮

### Requirement: CommandPalette All tab composes both lists

`all` tab SHALL 同時渲染 actions 與 messages：上半 `<FeatureList />`（actions）、下半 `<NavigationList />`（messages），每段有 section header。

#### Scenario: All tab shows both segments

- **WHEN** 切到 all tab
- **THEN** DOM 同時出現 actions section header 與 messages section header
- **AND** 各段 rows 數量正確

### Requirement: CommandPalette Messages tab preserves jump-to-message

點選訊息 row 後，palette MUST 關閉且目標訊息 MUST scroll 到 viewport 中。

#### Scenario: Click message jumps and closes

- **WHEN** 使用者在 messages tab 點選一則訊息
- **THEN** palette `onClose` 被呼叫
- **AND** 目標訊息 `scrollIntoView` 被觸發（可接受經 requestAnimationFrame / timeout）
