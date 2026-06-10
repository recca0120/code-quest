# Tmux Workspace UI — Proposal

## Why

Claude design 討論定案（high-fidelity handoff：`docs/design/README.md`＋`docs/design/tokens/App.proposal.css`）：把 workspace 全面 tmux 化。現有 UI 的問題——SessionBar 與 pane tree 兩套心智模型並存、工具 pane（files/git/spec）佔 pane tree 卻常常只想瞄一眼、入口分散（SessionBar dropdown／PanePicker／SessionManager 各管一段）、無 RWD。

本 branch（feat/discuss-layout）已完成的 pane tree／layout persistence／named components／worktree-centric 基礎與 handoff 的 State Management 段高度對齊，是這次改版的地基。

## What Changes

依 handoff 已定案決策（README「已定案的決策」表，像素級規格見 Screens 段）：

1. **Design tokens**：`tokens/App.proposal.css`（V1 陶土暗／V2 紙亮）替換 `apps/web/src/App.css` 的 `@theme` 段；新增 pane/tab/statusline/drawer/dock/motion/RWD tokens
2. **Workspace 外框**：頂部 tab bar 38px（logo＋編號 tabs＋busy 燈＋⌘K 鍵帽＋⚙）；底部狀態列 26px（focused pane 的 `project ⎇ branch`＋快捷鍵提示＋`N busy`）；**移除 SessionBar**（busy 聚合移至 tab 燈＋狀態列）
3. **Pane 共通殼**：30px header（編號徽章＋類型 icon＋標題＋meta＋`◫ ⬓ ⤢ ×`）、focused 邊框 accent、permission mode 換色、非 focus dim 0.75、最小 320×160（低於下限拒絕分割＋toast）
4. **Chat pane B/C 混搭**：內建右欄 rail 218px（files/git/spec 三分頁、⇥ 收合）⇄ 底部 dock chips（同一資料源、兩種展開態）；pane 寬 <720px 自動收合
5. **PanePicker Miller 三欄**（⌘K 唯一內容入口）：Projects → Worktrees → 類型 grid＋進行中＋resume 歷史＋常用組合（標準工作組 ⌘1）
6. **Drawer**：右側滑入 56%（min 480px）、左緣拖寬、「⊞ 釘選成 pane」→ descriptor 轉 pane tree 新 leaf
7. **Zoom bar**：⌘⇧Z 佔滿＋頂部 accent-soft 提示列
8. **拖曳重排**：header 拖起 ghost＋目標 pane 五落點（上下左右分割＋中央置換）；divider 6px 熱區＋hover 把手＋雙擊回 50%＋⌥方向鍵微調
9. **RWD**：desktop 全樹／tablet 上限 2 pane＋直立 tab 條／mobile 單 pane＋卡片牆切換器＋bottom sheet；**斷點不銷毀 pane tree**
10. **Descriptor registry**：leaf content 統一 `{ type, cwd, params }`；picker 類型清單、dock chips、drawer 釘選都讀 registry；新類型（terminal/diff）註冊一筆三入口自動出現

## Capabilities

- `design-tokens` — token 替換與元件 token
- `workspace-chrome` — tab bar／狀態列／SessionBar 移除
- `pane-shell` — pane 共通殼（編號、focused、min size）
- `chat-tool-rail` — B/C 混搭 rail/dock
- `pane-picker-miller` — ⌘K Miller 三欄
- `drawer-pin` — drawer＋釘選成 pane
- `pane-interactions` — DnD 五落點／divider／zoom bar／⌥微調
- `workspace-rwd` — tablet/mobile 行為

## Impact

- **Affected**: apps/web 全 workspace 層（App.css、WorkspaceTabBar、TabContainer、PaneTree/panes/*、PanePicker、KeyboardShortcutsProvider、SessionBar 刪除）；TabContext（rail state、registry）；schemas（layout v2 content descriptor 已就緒，rail state 需 persist）
- **Not affected**: server handlers（layout sync 協定不變，僅 payload 內容多 rail/params 欄位走既有 schema 演進）；ChatShell 訊息區/composer 沿用
- **風險**：SessionBar 移除牽動其測試與 overflow 邏輯；RWD 斷點渲染策略需保 pane tree state；DnD 在 jsdom 不可測的部分需 Playwright 驗收補
- **依賴**：本 branch 既有 pane tree／layout persistence／worktree-centric P1-P2（已完成）
