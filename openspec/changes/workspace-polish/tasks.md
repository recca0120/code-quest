# Workspace Polish — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline＋priming＋UI 驅動＋多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）


TDD；測試照 fake-summoner-client skill。按優先序排列。

## A. 小項收斂（worktree-centric 繼承）

- [x] A1 [test+impl] formatWorktreeLabel util 統一 branch ?? name fallback（抽到 workspace/pane-label.ts，4+ 處統一呼叫）
- [x] A2 [test+impl] tool pane header 與 §2 共通殼整併——WorktreeSwitcher emoji → PANE_TYPE_REGISTRY icon＋統一 header 組成順序
- [x] A5 [test+impl] PanePicker 建 session 時 branch 不傳入修正（6.8 不對稱）——onNewSession callback 帶 branch
- [x] A3 [test+impl] WorktreeSwitcher：cwd 不在 listing 顯示 basename＋警示 badge；下拉 project 分組＋✓ 標記
- [x] A6 [verified] sessions-diff disconnected→idle 不建 tab — by-design：TERMINAL_STATES 已含 disconnected，且 prevSessionIds 追蹤確保重連不重建 tab
- [x] A7 [verified] ChannelProvider remount 去重 — by-design：已有 "Channel already exists" guard（ChannelContext.tsx:76），pane split 重建時自動 fallthrough 到 joinSession；真正去重需 React key 管理，成本效益不合

## B. 功能增強（tmux §7 繼承）

- [ ] B5 [test+impl] pane 開合重排 200ms 動效（--dur-base＋flex-basis transition 或 FLIP）
- [ ] B1 [test+impl] tablet 直向 slide-over（58%、圓角 12、z-25、右滑收回、左拖固定成分割）
- [ ] B2 [test+impl] mobile 專屬頂列（txm-bar 48px：tab 下拉＋pane 編號 dots ①②③＋⊞ 切換器）
- [ ] B3 [test+impl] 卡片牆 preview 縮影＋「＋」新增卡＋取代切換版面
- [ ] B4 [test+impl] diff/terminal registry 類型實作（需 PTY 後端 + DiffView 元件）

## C. test-cleanup-web 收尾

- [ ] C1 剩餘 3 tasks（從 test-cleanup-web change 拉入，完成後 archive 該 change）
