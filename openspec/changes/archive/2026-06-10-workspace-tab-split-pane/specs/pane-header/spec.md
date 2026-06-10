## ADDED Requirements

### Requirement: Pane Header 顯示 Context 資訊
每個 split pane SHALL 在頂部顯示 pane header，內容包含目前 session 的 branch 名稱及 session title。

#### Scenario: 有 session 的 pane header
- **WHEN** pane 顯示一個 session
- **THEN** header 顯示 `⎇ <branch> · <session title>`

#### Scenario: 空白 pane header
- **WHEN** pane 無 session（sessionId 為 null）
- **THEN** header 顯示空白或「Pick a session」提示文字

---

### Requirement: 左右切割按鈕
Pane header SHALL 提供 `[⊟]` 按鈕，點擊後將該 pane 左右切割。

#### Scenario: 點擊 [⊟] 觸發左右切
- **WHEN** 使用者點擊 `[⊟]`
- **THEN** 該 pane 分為左右兩個子 pane

#### Scenario: Mobile 隱藏切割按鈕
- **WHEN** viewport 寬度 < 768px
- **THEN** `[⊟]` 按鈕不顯示

---

### Requirement: 上下切割按鈕
Pane header SHALL 提供 `[⊞]` 按鈕，點擊後將該 pane 上下切割。

#### Scenario: 點擊 [⊞] 觸發上下切
- **WHEN** 使用者點擊 `[⊞]`
- **THEN** 該 pane 分為上下兩個子 pane

#### Scenario: Mobile 隱藏切割按鈕
- **WHEN** viewport 寬度 < 768px
- **THEN** `[⊞]` 按鈕不顯示

---

### Requirement: 關閉 Pane 按鈕
Pane header SHALL 提供 `[×]` 按鈕，點擊後關閉該 pane（session 不結束）。唯一 pane 時按鈕為 disabled。

#### Scenario: 關閉 pane
- **WHEN** 使用者點擊 `[×]`，且畫面有至少兩個 pane
- **THEN** pane 關閉，session 保留於 Tab Bar

#### Scenario: 唯一 pane 時 disabled
- **WHEN** 畫面只有一個 pane
- **THEN** `[×]` 按鈕顯示為 disabled，無法點擊

---

### Requirement: Focus 視覺指示
Focused pane SHALL 在其邊框或 header 顯示明顯的視覺指示，與非 focused pane 有明確區別。

#### Scenario: Focused pane 樣式
- **WHEN** pane 為 focused 狀態
- **THEN** pane 外框或 header 顯示 accent 色指示

#### Scenario: 非 focused pane 樣式
- **WHEN** pane 非 focused 狀態
- **THEN** 外框或 header 無 accent 色指示
