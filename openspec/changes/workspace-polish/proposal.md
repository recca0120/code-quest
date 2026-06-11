# Workspace Polish — Proposal

## Why

tmux-workspace-ui 與 worktree-centric-workspace 的核心行為骨架已完成並 archive。這個 change 收集**剩餘的功能增強與收斂**——來自 tmux §7 backlog 與 worktree §5/§6 的未完成項。

## Scope（按優先序）

### 從 worktree-centric 繼承（§5/§6 留後）

| # | 內容 | 量 |
|---|---|---|
| A1 | `formatWorktreeLabel` util 統一 branch ?? name fallback（4+ 處） | trivial |
| A2 | tool pane header 與共通殼（handoff §2）整併——WorktreeSwitcher emoji → registry icon | small |
| A3 | WorktreeSwitcher：cwd 不在 listing 顯示 basename＋警示；下拉 project 分組＋✓ | small |
| A4 | tool pane follow:'focused-session' 模式（wire 已預留 target.kind） | medium |
| A5 | picker branch 傳入 onNewSession 不對稱修正（6.8） | small |
| A6 | sessions-diff disconnected→idle 不建 tab（6.9，需確認是否為 bug） | small |
| A7 | ChannelProvider remount 去重（6.11，評估） | small |

### 從 tmux §7 繼承

| # | 內容 | 量 |
|---|---|---|
| B1 | tablet 直向 slide-over（58%、拖到底固定成分割） | large |
| B2 | mobile 專屬頂列（txm-bar：tab 下拉＋pane dots＋⊞） | large |
| B3 | 卡片牆 preview 縮影＋「＋」新增卡＋取代切換版面 | medium |
| B4 | diff/terminal registry 類型實作 | large（依賴後端） |
| B5 | pane 重排 200ms 動效（--dur-base） | medium |

### 從 test-cleanup-web 繼承（10/13）

| # | 內容 |
|---|---|
| C1 | 剩餘 3 tasks 收尾 |

## 建議順序

A1 → A2 → A5 → A3 → A6/A7 → B5 → A4 → B1/B2（大功能視需求） → B4（等後端）
