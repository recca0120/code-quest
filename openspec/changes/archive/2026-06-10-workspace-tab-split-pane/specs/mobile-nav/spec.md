## MODIFIED Requirements

### Requirement: Split Pane 在 Mobile 退化為單 Pane

在 mobile viewport（< 768px）下，系統 SHALL 強制顯示單一 pane，不提供切割功能。Sidebar 與 Right Pane 維持 slide-in drawer 行為。

#### Scenario: Mobile 不顯示切割按鈕
- **WHEN** viewport 寬度 < 768px
- **THEN** pane header 的 `[⊟]` 和 `[⊞]` 按鈕不顯示

#### Scenario: Mobile 單 pane 顯示
- **WHEN** viewport 寬度 < 768px
- **THEN** 無論 pane tree 結構為何，只顯示 focused pane 的內容，其他 pane 隱藏

#### Scenario: Sidebar drawer 行為不變
- **WHEN** viewport 寬度 < 768px，使用者點擊 Global Bar 的 `[☰]`
- **THEN** sidebar 以 slide-in drawer 方式展開（覆蓋主內容）

#### Scenario: Right Pane drawer 行為不變
- **WHEN** viewport 寬度 < 768px，使用者點擊 Tab Bar 的 `[▥]`
- **THEN** Right Pane 以 slide-in drawer 方式展開
