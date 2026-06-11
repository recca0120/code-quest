# Workspace Polish — Tasks

TDD；測試照 fake-summoner-client skill。按優先序排列。

## A. 小項收斂（worktree-centric 繼承）

- [ ] A1 [test+impl] formatWorktreeLabel util 統一 branch ?? name fallback（抽到 workspace/pane-label.ts，4+ 處統一呼叫）
- [ ] A2 [test+impl] tool pane header 與 §2 共通殼整併——WorktreeSwitcher emoji → PANE_TYPE_REGISTRY icon＋統一 header 組成順序
- [ ] A5 [test+impl] PanePicker 建 session 時 branch 不傳入修正（6.8 不對稱）——onNewSession callback 帶 branch
- [ ] A3 [test+impl] WorktreeSwitcher：cwd 不在 listing 顯示 basename＋警示 badge；下拉 project 分組＋✓ 標記
- [ ] A6 [test+impl] sessions-diff disconnected→idle 不建 tab（6.9）——確認是否 bug 並修或記錄為 by-design
- [ ] A7 [test+impl] ChannelProvider remount 去重（6.11）——評估成本效益後修或記錄

## B. 功能增強（tmux §7 繼承）

- [ ] B5 [test+impl] pane 開合重排 200ms 動效（--dur-base＋flex-basis transition 或 FLIP）
- [ ] B1 [test+impl] tablet 直向 slide-over（58%、圓角 12、z-25、右滑收回、左拖固定成分割）
- [ ] B2 [test+impl] mobile 專屬頂列（txm-bar 48px：tab 下拉＋pane 編號 dots ①②③＋⊞ 切換器）
- [ ] B3 [test+impl] 卡片牆 preview 縮影＋「＋」新增卡＋取代切換版面
- [ ] B4 [test+impl] diff/terminal registry 類型實作（需 PTY 後端 + DiffView 元件）

## C. test-cleanup-web 收尾

- [ ] C1 剩餘 3 tasks（從 test-cleanup-web change 拉入，完成後 archive 該 change）
