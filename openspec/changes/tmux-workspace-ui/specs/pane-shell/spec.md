# pane-shell Spec

## ADDED Requirements

### Requirement: 共通 pane 殼

每個 leaf SHALL 渲染統一殼：30px header（編號徽章＋類型 icon＋標題＋meta＋動作 `◫ ⬓ ⤢ ×`）、圓角 10、1px 邊框、內容超出裁切。pane 編號 SHALL 依樹的先序遍歷穩定編號並顯示於徽章與（按住 pane-jump 鍵時）跳轉。

#### Scenario: focused 樣式與 permission mode 換色
- **WHEN** pane 取得 focus
- **THEN** 邊框 accent55%＋外圈 ring；permission mode 為 plan 時邊框用 info 色、bypass 用 danger 色
- **WHEN** pane 失去 focus
- **THEN** 內容 opacity 0.75

### Requirement: 最小尺寸護欄

分割造成任一 pane 寬 <320 或高 <160 時 SHALL 拒絕分割並 toast 提示。護欄 SHALL 在 reducer 層生效（涵蓋 header 按鈕、⌘D/⌘⇧D、picker ⌘⏎、DnD 方向落點所有路徑）。

#### Scenario: 過窄拒絕分割
- **WHEN** pane 寬 600px 且使用者觸發垂直分割（將產生 2×300px）
- **THEN** 分割不發生、顯示 toast、pane tree 不變
