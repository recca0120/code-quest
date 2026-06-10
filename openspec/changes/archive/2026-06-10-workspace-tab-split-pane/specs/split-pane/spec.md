## ADDED Requirements

### Requirement: Pane Tree 結構
Chat 區域 SHALL 以 binary tree 表示 pane 排列。每個節點為 leaf（顯示一個 session）或 split（含方向、比例、兩個子節點）。初始狀態為單一 leaf pane。

#### Scenario: 初始狀態為單 pane
- **WHEN** workspace 載入
- **THEN** chat 區域顯示單一 pane，無分隔線

#### Scenario: Pane tree 正確對應畫面
- **WHEN** pane tree 為 `split(h, 0.5, leaf(A), split(v, 0.5, leaf(B), leaf(C)))`
- **THEN** 畫面左側顯示 Session A，右上顯示 Session B，右下顯示 Session C

---

### Requirement: 左右切割
使用者 SHALL 能將任意 pane 左右切割為兩個子 pane。切割後原 pane 的 session 在左側，右側為空白 pane。

#### Scenario: 點擊 [⊟] 左右切
- **WHEN** 使用者點擊 pane header 的 `[⊟]`
- **THEN** 該 pane 分為左右兩個，左側保留原 session，右側為空白

---

### Requirement: 上下切割
使用者 SHALL 能將任意 pane 上下切割為兩個子 pane。切割後原 pane 的 session 在上方，下方為空白 pane。

#### Scenario: 點擊 [⊞] 上下切
- **WHEN** 使用者點擊 pane header 的 `[⊞]`
- **THEN** 該 pane 分為上下兩個，上方保留原 session，下方為空白

---

### Requirement: 任意深度切割
Split pane SHALL 支援任意深度的遞迴切割，不限制層數。

#### Scenario: 三層切割
- **WHEN** 使用者對已切割的子 pane 再次切割
- **THEN** 產生三個或更多 pane，各自獨立顯示

---

### Requirement: 關閉 Pane
使用者 SHALL 能關閉任意 pane（非 session）。關閉後 session 繼續存活於 Tab Bar，兄弟 pane 填滿空間。

#### Scenario: 關閉非唯一 pane
- **WHEN** 使用者點擊 pane header 的 `[×]`，且畫面上有至少兩個 pane
- **THEN** 該 pane 消失，其兄弟 pane 填滿原有空間，session 仍在 Tab Bar

#### Scenario: 最後一個 pane 無法關閉
- **WHEN** 畫面上只剩一個 pane
- **THEN** pane header 的 `[×]` 為 disabled 狀態，點擊無效

---

### Requirement: Resize
使用者 SHALL 能拖曳兩個 pane 之間的分隔線調整比例。

#### Scenario: 拖曳分隔線
- **WHEN** 使用者按住分隔線並拖曳
- **THEN** 兩側 pane 的比例即時更新，總空間不變

#### Scenario: 最小比例限制
- **WHEN** 使用者拖曳至極端位置
- **THEN** 每個 pane 維持最小寬度 / 高度（不小於 200px），不允許 pane 消失

---

### Requirement: Focus Model
點擊任意 pane SHALL 使該 pane 成為 focused pane。Focused pane 有明顯視覺指示（藍色外框）。

#### Scenario: 點擊 pane 取得 focus
- **WHEN** 使用者點擊任意 pane 的任意位置
- **THEN** 該 pane 顯示 focus 外框，其他 pane 外框消失

#### Scenario: 關閉 focused pane 後 focus 轉移
- **WHEN** 使用者關閉目前 focused pane
- **THEN** focus 自動轉移至最近使用的相鄰 pane

---

### Requirement: Tab Bar 點擊填入 Focused Pane
點擊 Tab Bar 上的 session tab SHALL 將該 session 填入 focused pane。若該 session 已在某 pane 顯示，SHALL 改為 focus 那個 pane。

#### Scenario: Tab 點擊填入空白 pane
- **WHEN** focused pane 為空白，使用者點擊 Tab Bar 上的 session tab
- **THEN** 該 session 填入 focused pane

#### Scenario: Tab 點擊替換 pane 內容
- **WHEN** focused pane 已有 session，使用者點擊另一個 session 的 tab
- **THEN** focused pane 換成新 session，舊 session 回到 tab bar（未 active 狀態）

#### Scenario: Tab 點擊 focus 既有 pane
- **WHEN** 使用者點擊的 session 已在某個 pane 顯示
- **THEN** focus 移到顯示該 session 的 pane，不移動 session

---

### Requirement: 同一 Session 不可出現在兩個 Pane
系統 SHALL 確保同一個 session 最多在一個 pane 中顯示。

#### Scenario: 防止重複顯示
- **WHEN** session A 已在左側 pane 顯示，使用者點擊 session A 的 tab
- **THEN** focus 移到左側 pane，不在其他 pane 再次顯示 session A

---

### Requirement: 空白 Pane Session Picker
空白 pane SHALL 顯示 session picker，列出所有未在其他 pane 顯示的 session，及新增 session 按鈕。

#### Scenario: 空白 pane 顯示 picker
- **WHEN** pane 的 sessionId 為 null
- **THEN** 顯示「Pick a session」列表及「New session here」按鈕

#### Scenario: Picker 只列出未顯示的 session
- **WHEN** Session A 已在其他 pane 顯示
- **THEN** Session A 不出現在空白 pane 的 picker 列表中

---

### Requirement: Keyboard Navigation
使用者 SHALL 能用鍵盤在 pane 之間移動 focus 及執行切割操作。

#### Scenario: 鍵盤移動 focus
- **WHEN** 使用者按 `⌘⌥←/→/↑/↓`
- **THEN** focus 移動到對應方向的相鄰 pane

#### Scenario: 鍵盤切割
- **WHEN** 使用者按 `⌘\`
- **THEN** focused pane 執行左右切割
- **WHEN** 使用者按 `⌘-`
- **THEN** focused pane 執行上下切割

#### Scenario: 鍵盤關閉 pane
- **WHEN** 使用者按 `⌘W`，且畫面上有至少兩個 pane
- **THEN** focused pane 關閉

---

### Requirement: Mobile 退化為單 Pane
在 mobile viewport（< 768px）下，split 功能 SHALL 隱藏，強制單 pane 顯示。

#### Scenario: Mobile 不顯示切割按鈕
- **WHEN** viewport 寬度 < 768px
- **THEN** pane header 不顯示 `[⊟]` 和 `[⊞]` 按鈕

#### Scenario: Mobile 強制單 pane
- **WHEN** viewport 寬度 < 768px
- **THEN** 無論 pane tree 狀態為何，只顯示 focused pane 的內容
