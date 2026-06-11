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

- [x] B5 [test+impl] pane 開合重排 200ms 動效（--dur-base＋flex-basis transition 或 FLIP）
- [x] B1 → 獨立 change `tablet-slide-over` 完成（14/14）
- [x] B2 → 獨立 change `mobile-rwd-polish` 完成（16/16，含 B3）
- [x] B3 → 獨立 change `mobile-rwd-polish` 完成（16/16，含 B2）
- [x] B4 → 獨立 change `diff-terminal-panes` 開設（0/20，需後端 PTY，待實作）

## C. test-cleanup-web 收尾

- [x] C1 → 獨立 change `test-cleanup-web` 完成（13/13）
