## 1. Schema & 型別

- [ ] 1.1 `streamChunkSchema` 加 `estimatedTokens?: number`
- [ ] 1.2 `Block` interface 加 `estimatedTokens?: number`

## 2. Summoner Transform

- [ ] 2.1 `thinking_delta` case 讀取 `estimated_tokens` 並帶入 chunk payload

## 3. Web Streaming Handler

- [ ] 3.1 `onThinkingChunk` 接收 `estimatedTokens` 參數並累加到 block
- [ ] 3.2 `onStreamChunk` 傳遞 `chunk.estimatedTokens` 給 `onThinkingChunk`

## 4. useSmoothedValue Hook

- [ ] 4.1 建立 `apps/web/src/hooks/useSmoothedValue.ts`，實作 easing 補間與 snap 邏輯
- [ ] 4.2 撰寫 `useSmoothedValue` 的單元測試

## 5. ThinkingTokenCount 元件

- [ ] 5.1 實作 `formatTokens(n)` 格式化函式
- [ ] 5.2 實作 file-local `ThinkingTokenCount` 元件（含 `useSmoothedValue`）
- [ ] 5.3 撰寫 `ThinkingTokenCount` 格式化與渲染的單元測試

## 6. ThinkingBlock 整合

- [ ] 6.1 `ThinkingBlock` props 加 `estimatedTokens?: number`
- [ ] 6.2 組合 header ReactNode，在 `isStreaming && estimatedTokens` 時渲染 `ThinkingTokenCount`
- [ ] 6.3 `AssistantTurnContent` 傳遞 `block.estimatedTokens` 給 `ThinkingBlock`
- [ ] 6.4 撰寫 `ThinkingBlock` streaming 狀態下顯示 token count 的測試
