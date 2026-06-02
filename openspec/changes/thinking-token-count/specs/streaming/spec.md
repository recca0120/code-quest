## ADDED Requirements

### Requirement: thinking_delta 的 estimated_tokens 傳遞到 Block

當 `thinking_delta` 帶有 `estimated_tokens` 欄位時，系統 SHALL 將此增量值累加至對應 thinking block 的 `estimatedTokens` 欄位。

#### Scenario: 帶有 estimated_tokens 的 delta
- **WHEN** `stream:chunk(thinking)` 的 `estimatedTokens` 為 50
- **THEN** 對應 thinking block 的 `estimatedTokens` 增加 50

#### Scenario: 不帶 estimated_tokens 的 delta
- **WHEN** `stream:chunk(thinking)` 的 `estimatedTokens` 為 undefined
- **THEN** block 的 `estimatedTokens` 不變（保持 undefined 或既有值）

#### Scenario: 新 thinking block 建立時帶 estimated_tokens
- **WHEN** 第一個 thinking chunk 到達且 `estimatedTokens` 為 30
- **THEN** 新建立的 block 的 `estimatedTokens` 為 30
