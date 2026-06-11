# chat-tool-rail Spec

## ADDED Requirements

### Requirement: chat pane 內建側欄（rail）與 dock 為同一資料源的兩種展開態

chat leaf SHALL 內建右欄 rail（218px：files/git/spec 三分頁＋count 徽章＋⇥ 收合＋底部 hint）；收合後 SHALL 變 chat 底部 dock chips（28px pill＋count＋active 態）。兩者 SHALL 讀同一 per-worktree 資料（GitProvider/FsProvider/OpenspecProvider，以該 chat 的 cwd 為 target），切換不重新抓取。

#### Scenario: ⇥ 收合 rail 變 dock
- **WHEN** 使用者點 rail 的 ⇥
- **THEN** rail 消失、底部出現同樣三個 chips（count 一致）；點 chip 重新展開 rail 至該分頁

### Requirement: rail 狀態 per-pane persist

`{ railOpen, railTab }` SHALL 存於 leaf content `params` 並隨 layout persistence 同步/還原；wire schema SHALL 以 optional 欄位演進（不 bump 版本），缺省 = `{ railOpen: true, railTab: 'files' }`。

#### Scenario: reload 還原 rail 狀態
- **WHEN** 使用者把 rail 切到 git 分頁後收合成 dock，reload
- **THEN** 還原為 dock 態且記住 git 分頁

### Requirement: 窄 pane 自動收合

chat pane 寬 <720px 時 rail SHALL 自動收合成 dock（ResizeObserver 觀察 pane 元素）；恢復寬度不自動展開（尊重使用者上次手動狀態）。

#### Scenario: 分割導致變窄
- **WHEN** rail 展開的 chat pane 被分割後寬度 <720px
- **THEN** rail 自動收合成 dock

### Requirement: 升級成 pane 與開 drawer

rail SHALL 支援：⤢ 以 drawer 檢視目前分頁完整內容（項目級 drawer 留 registry diff 類型擴充後實作）；`⌘⏎` 把目前 rail 分頁升級成獨立 pane（descriptor 經 registry 轉 leaf，於 chat pane 右側垂直分割）。

#### Scenario: ⌘⏎ 升級
- **WHEN** rail 顯示 git 分頁時按 ⌘⏎
- **THEN** chat pane 右側出現 git pane（同 cwd），rail 維持原狀
