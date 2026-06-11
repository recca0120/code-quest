# workspace-rwd Spec

## ADDED Requirements

### Requirement: 斷點只改渲染數，不銷毀 pane tree

`visiblePaneIds` SHALL 由 zoom > RWD 上限 > 全部 推導：desktop（≥1024）全樹、tablet（768–1023）上限 2、mobile（<768）單 pane（沿用 repo 既有 767 斷點體系，與 handoff 的 640 偏差已確認）。被收納的 pane SHALL 保留 state 與 session 連線（不 unmount session——SessionPool 保活）；回到桌面 SHALL 原樹還原。

#### Scenario: 縮到 tablet 再回桌面
- **WHEN** 4-pane 桌面視窗縮至 800px 再放回 1440px
- **THEN** tablet 期間只渲染 2 pane＋直立 tab 條；回桌面 4 pane 原結構原 ratio 還原，sessions 未斷線

### Requirement: tablet 行為

超出上限的 pane SHALL 收成右側 34px 直立 tab 條（vertical-rl），點擊與目前 pane 交換；直向 SHALL 單 pane＋slide-over（寬 58%，拖到底固定成分割）；拖曳保留。

#### Scenario: 直立 tab 條交換
- **WHEN** 點直立條中的 pane ③
- **THEN** ③ 與目前可見 pane 交換（pane tree 結構不變，只換 visible 集合）

### Requirement: mobile 行為

mobile SHALL：單 pane 全幅、頂列 tab 下拉＋pane 編號圓點＋⊞ 切換器、左右滑切 pane、不提供分割與拖曳、drawer 變 bottom sheet（snap 0/66%/100%）、pane tree 攤平為卡片牆切換器（2 欄、active 卡 accent 框）、composer 輸入 16px、dock/sheet 含 safe-area-inset-bottom。

#### Scenario: 卡片牆切換
- **WHEN** mobile 點 ⊞ 開卡片牆並點 pane ② 的卡
- **THEN** 顯示 pane ②（其他 pane state 保留）
