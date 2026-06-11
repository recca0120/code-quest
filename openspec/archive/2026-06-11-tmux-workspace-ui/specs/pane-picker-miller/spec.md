# pane-picker-miller Spec

## ADDED Requirements

### Requirement: Miller 三欄結構（⌘K 唯一內容入口）

PanePicker SHALL 重構為 Miller 三欄：欄1 Projects（含「＋ 新增 Project…」）、欄2 該 project 的 Worktrees（含 chats 數/busy、「＋ 新增 worktree…」）、欄3 = 類型 grid（registry 驅動：icon＋名稱＋快捷字母）＋進行中 sessions（busy＋所在 pane 編號）＋resume 歷史（相對時間）＋常用組合。窄視窗（<約 1024px modal 空間）SHALL 退化為單欄逐段。git listing 載入中 SHALL 顯示 loading 態（非空白）。

#### Scenario: 三欄聯動
- **WHEN** 在欄1 選擇另一個 project
- **THEN** 欄2 顯示該 project 的 worktrees、欄3 跟隨目前 worktree 更新進行中/歷史

### Requirement: 鍵盤協定

picker SHALL 支援：`←→` 換欄、`↑↓` 移動、`⏎` 開啟到目前 focused pane（`setContentInPane`）、`⌘⏎` 分割開啟（`splitPaneAndAssign`）、`F/G/O/D/T` 直選類型、`esc` 關閉、頂部搜尋過濾三欄。

#### Scenario: 全鍵盤開 pane
- **WHEN** ⌘K → ↓ 選 worktree → → 進欄3 → G → ⏎
- **THEN** focused pane 內容變為該 worktree 的 git pane，picker 關閉

#### Scenario: ⌘⏎ 受 min-size 護欄約束
- **WHEN** ⌘⏎ 分割開啟會使 pane 低於最小尺寸
- **THEN** 拒絕並 toast（pane-shell 護欄同一來源）

### Requirement: 常用組合（標準工作組）

欄3 底部 SHALL 提供「標準工作組 chat＋files＋git（⌘1）」：一次建立預組分割（chat 左、files/git 右欄上下）於目前 tab，descriptor 全部來自 registry。

#### Scenario: ⌘1 建立標準工作組
- **WHEN** 選定 worktree 後按 ⌘1
- **THEN** 產生 3-pane 預組版面，三個 pane 的 cwd 同為該 worktree
