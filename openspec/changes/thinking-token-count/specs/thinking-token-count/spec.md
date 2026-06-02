## ADDED Requirements

### Requirement: ThinkingTokenCount 顯示累積 estimated tokens

在 thinking block streaming 期間，系統 SHALL 在 ThinkingBlock header 旁顯示累積的 estimated token 數量。思考結束（isStreaming = false）後，token 計數 SHALL 消失。

#### Scenario: 累積 tokens 顯示
- **WHEN** thinking block 的 `isStreaming` 為 true 且 `estimatedTokens` > 0
- **THEN** header 旁顯示格式化的 token 數量

#### Scenario: 思考結束後消失
- **WHEN** thinking block 的 `isStreaming` 變為 false
- **THEN** token 計數不再顯示

#### Scenario: 無 estimatedTokens 時不顯示
- **WHEN** thinking block 的 `estimatedTokens` 為 undefined 或 0
- **THEN** ThinkingTokenCount 不渲染

### Requirement: 格式化規則

系統 SHALL 根據數值大小選擇顯示格式。

#### Scenario: 小於 1000
- **WHEN** token 數量為 500
- **THEN** 顯示「500 tokens」

#### Scenario: 1000 以上
- **WHEN** token 數量為 1200
- **THEN** 顯示「1.2k tokens」

#### Scenario: 零或負數
- **WHEN** token 數量 ≤ 0
- **THEN** 回傳 null（不顯示）

### Requirement: useSmoothedValue 平滑動畫

`useSmoothedValue(target)` hook SHALL 在 target 增加時以 easing 補間逼近，在 target 減少時立即 snap。

#### Scenario: target 增加
- **WHEN** target 從 0 增加到 1000
- **THEN** displayed value 逐步增加（不立刻跳到 1000）

#### Scenario: target 減少（block 重置）
- **WHEN** target 從 1000 減少到 0
- **THEN** displayed value 立即 snap 到 0

#### Scenario: hook unmount
- **WHEN** component unmount
- **THEN** setInterval 被清除，無 memory leak
