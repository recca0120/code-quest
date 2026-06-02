## Why

ThinkingBlock 在串流過程中只顯示「Thinking...」，用戶無法感知思考進度的規模。Claude API 的 `thinking_delta` 事件帶有 `estimated_tokens` 增量欄位，可即時反映思考量，提供更豐富的視覺回饋。

## What Changes

- `streamChunkSchema` 新增 `estimatedTokens?: number` 欄位
- summoner stream transform 將 `thinking_delta.estimated_tokens` 傳入 `stream:chunk` payload
- `Block` 型別新增 `estimatedTokens?: number`，由 streaming handler 累加
- 新增 `useSmoothedValue` hook，提供數字平滑動畫（增加 easing 補間，減少立即 snap）
- `ThinkingBlock` 在 `isStreaming && estimatedTokens` 時渲染 `ThinkingTokenCount` 元件，思考結束後消失

## Capabilities

### New Capabilities

- `thinking-token-count`: 在 ThinkingBlock streaming 期間即時顯示累積的 estimated token 數量，含平滑動畫與格式化

### Modified Capabilities

- `streaming`: `stream:chunk` payload 新增 `estimatedTokens` 選填欄位（非 breaking，既有消費者無需修改）

## Impact

- `packages/schemas/src/socket/message-stream.ts` — schema 異動
- `apps/summoner/src/claude/transforms/stream.ts` — transform 異動
- `apps/web/src/types/ui.ts` — Block 型別異動
- `apps/web/src/contexts/channel/handlers/streaming.ts` — handler 異動
- `apps/web/src/hooks/useSmoothedValue.ts` — 新建
- `apps/web/src/components/chat/conversation/ThinkingBlock.tsx` — 新增 ThinkingTokenCount 元件與渲染邏輯
