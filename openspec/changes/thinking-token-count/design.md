## Context

ThinkingBlock 目前在串流期間只顯示靜態的「Thinking...」標籤。Claude API 的 `thinking_delta` 事件包含 `estimated_tokens` 增量欄位，但目前的 pipeline 未傳遞此欄位。資料需要從 summoner 層穿過 socket schema 到 web 的 zustand store，最終在 React 元件顯示。

## Goals / Non-Goals

**Goals:**
- 在 thinking streaming 期間顯示累積 estimated token 數量
- 數字平滑動畫，避免跳動感
- 思考結束後 token 計數消失（顯示「Thought for Xs」）

**Non-Goals:**
- 精確的 token 計數（`estimated_tokens` 本身是估算值）
- 思考結束後保留計數
- 對舊版無 `estimated_tokens` 的 delta 做任何補償

## Decisions

### 1. 資料穿透層：schema 加選填欄位

`streamChunkSchema` 加 `estimatedTokens?: number`，summoner 從 raw delta 讀取 `estimated_tokens`（若存在）帶入 chunk payload。Web handler 累加到 `Block.estimatedTokens`。

**選擇理由**：選填欄位不 breaking，無 `estimated_tokens` 的舊 delta 照常運作。

### 2. Smoother：`useSmoothedValue` hook，`useRef` + `useState`

extension 使用 WeakMap keyed by signal 物件。我們的 zustand state 是 immutable object，每次更新都是新物件，WeakMap 不適用。改用 **`useRef` 儲存 smoother 內部狀態**（target、intervalId），`useState` 儲存 displayed value 觸發 re-render。hook lifetime 與 component 綁定，unmount 時自動 cleanup。

easing 公式：每 100ms `displayed += Math.ceil((target - displayed) * 0.15)`，差距 < 1 時 snap。target 減少時立即 snap（新 thinking block 重置）。

**選擇理由**：React 慣用模式，無外部依賴，lifecycle 自然對應。

### 3. ThinkingTokenCount 位置：header ReactNode 組合

`BlockCollapsible.header` 接受 `React.ReactNode`，在 `ThinkingBlock` 內組合：

```tsx
const header = (
  <div className="flex items-center gap-2">
    <ToolUseHeader icon={null} name={label} />
    {isStreaming && estimatedTokens && (
      <ThinkingTokenCount estimate={estimatedTokens} />
    )}
  </div>
);
```

`ThinkingTokenCount` 是 `ThinkingBlock.tsx` 內的 file-local 元件，只此一處使用。

**選擇理由**：不修改 `ToolUseHeader`（共用元件），`BlockCollapsible` 介面也不動。

## Risks / Trade-offs

- `estimated_tokens` 在真實 API 中是否每個 delta 都有尚未由 fixture 驗證 → 以選填處理，無此欄位時不顯示
- smoother setInterval 100ms 在快速串流時可能落後 target → 可接受，視覺上本來就要有延遲感
