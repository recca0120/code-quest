# pane-interactions Spec

## ADDED Requirements

### Requirement: 拖曳重排五落點

抓 pane header 拖起 SHALL 顯示 ghost（縮影、-1.5°、陰影）；目標 pane SHALL 浮出五落點：上/下/左/右（該方向分割並移入）＋中央（置換，既有 swap）。方向落點 SHALL 受 min-size 護欄約束（拒絕時落點顯示 disabled 態）。

#### Scenario: 拖到右落點
- **WHEN** pane ① header 拖到 pane ② 的右落點
- **THEN** ② 垂直分割、①內容移至新右半、①原位置由樹收斂規則處理（單子 split 拉平）

#### Scenario: 中央置換
- **WHEN** 拖到中央落點
- **THEN** 兩 pane 內容互換（結構不變，既有 swap 行為）

### Requirement: divider 操作

divider SHALL：視覺 1px、熱區 6px、hover 顯把手＋resize 游標、拖曳即時 reflow、雙擊重設 50%、focused pane 可用 ⌥方向鍵微調邊界（步進固定百分比）。

#### Scenario: 雙擊回 50%
- **WHEN** ratio 0.7 的 split divider 被雙擊
- **THEN** ratio 回 0.5 並經 layout persistence 存檔

### Requirement: zoom bar

⌘⇧Z zoom 時 SHALL 顯示頂部 zoom bar（accent-soft）：「⤢ Zoom 中 — pane ② {標題}（共 N 個 pane）」＋「⌘⇧Z 或 esc 返回」；esc SHALL 也能解除 zoom；header 顯示 ⤢ 徽章。

#### Scenario: esc 解除 zoom
- **WHEN** zoom 中按 esc（且無更高優先的 esc consumer 如 drawer/picker 開啟）
- **THEN** 返回分割視圖，focus 維持
