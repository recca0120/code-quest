# drawer-pin Spec

## ADDED Requirements

### Requirement: 全域單例 drawer

drawer SHALL 為全域單例 `{ descriptor, width } | null`（不 persist）：桌面/平板右側滑入（寬 56%、min 480px、左緣 6px 拖寬把手）、遮罩點擊或 esc 關閉。header SHALL 含類型 icon＋完整路徑＋diffstat＋動作：「⊞ 釘選成 pane」（primary）、「⤢ 全螢幕」、✕。

#### Scenario: rail 項目開 drawer
- **WHEN** 點 rail files 分頁中的某檔案
- **THEN** drawer 滑入顯示該檔完整內容；esc 關閉且 focus 回到原 pane

### Requirement: 釘選成 pane

「⊞ 釘選成 pane」SHALL 把 drawer 的 content descriptor 轉成 pane tree 新 leaf（focused pane 右側垂直分割，registry 統一轉換），然後關閉 drawer。受 min-size 護欄約束。

#### Scenario: 釘選
- **WHEN** drawer 顯示 git diff 時點「⊞ 釘選成 pane」
- **THEN** focused pane 右側出現 git pane（同 descriptor），drawer 關閉，layout 經 debounce 存檔
