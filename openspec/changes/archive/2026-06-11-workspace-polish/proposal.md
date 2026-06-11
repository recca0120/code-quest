# Workspace Polish — Proposal

## Why

tmux-workspace-ui 與 worktree-centric-workspace 的核心行為骨架已完成並 archive。這個 change 收集**剩餘的功能增強與收斂**——來自 tmux §7 backlog 與 worktree §5/§6 的未完成項。

## 完成項（A 系列 + B5）

| # | 內容 | 結果 |
|---|---|---|
| A1 | `formatWorktreeLabel` util 統一 branch ?? name fallback（10 處） | ✓ pane-label.ts |
| A2 | WorktreeSwitcher emoji → PANE_TYPE_REGISTRY icon（±▤◈） | ✓ prop rename + values |
| A3 | WorktreeSwitcher：cwd 不在 listing 顯示 basename＋⚠；下拉 ✓ 標記 | ✓ |
| A5 | PanePicker onNewSession 帶 branch（修不對稱） | ✓ 第 5 參數 |
| A6 | sessions-diff disconnected→idle 不建 tab | ✓ verified by-design |
| A7 | ChannelProvider remount 去重 | ✓ verified by-design |
| B5 | pane 開合重排 200ms 動效 | ✓ transition-all on split wrappers |

## 拆出的獨立 changes

| 原項 | 獨立 change | 狀態 |
|---|---|---|
| B1 tablet slide-over | `tablet-slide-over` | 14/14 complete |
| B2 mobile 頂列 | `mobile-rwd-polish` | 16/16 complete（含 B3） |
| B3 卡片牆 preview | `mobile-rwd-polish` | 同上 |
| B4 diff/terminal | `diff-terminal-panes` | 0/20（需後端 PTY） |
| C1 test-cleanup 收尾 | `test-cleanup-web` | 13/13 complete |
