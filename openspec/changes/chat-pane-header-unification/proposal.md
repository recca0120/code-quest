# Chat Pane Header Unification — Proposal

## Why

實際使用截圖（2026-06-11）發現兩個問題：

1. **雙層 header**：每個 chat pane 有 pane header（30px：編號＋◫⬓⤢×）＋ ChatBreadcrumb（44px：project/branch/title 麵包屑＋☰／⟲ Resume／⊞ 按鈕）兩條 bar——handoff §2 定案是**單一 30px header**。麵包屑文字與 pane header 的 `⎇ branch · title`、statusline 的 `project ⎇ branch` 三重重複。
2. **chat view 沒有全版**：SessionPane 的 rail wrapper 用 `h-full`（＝父高 100%，未扣 pane header 30px）→ chat 內容底部被 overflow 裁掉／高度不滿。

## What Changes

1. **ChatBreadcrumb 移除**（44px 整條）：
   - 文字麵包屑：資訊已由 pane header（⎇ branch · title）＋ statusline（project ⎇ branch）承載，直接刪
   - `☰ Toggle left sidebar`／`⊞ Toggle right pane` 按鈕：**上移 pane header 的 tools slot**（SessionPane 經 PaneShell，aria-label 不變——測試契約保留）
   - `⟲ ResumeButton`：**移除**——resume 入口由 ⌘K picker 的「歷史（resume）」承接（trade-off：ResumeButton 的 resumeRoute 智慧路由〔empty→replace、跨 cwd→activate〕簡化為 picker 的「resume 到 focused pane」；若實用上想念舊路由再回補）
2. **高度鏈修正**：SessionPane wrapper `h-full` → `flex-1 min-h-0`（chat 撐滿 pane 剩餘空間）
3. **props 鏈清理**：ChatView 不再收 `title/projectName/onToggleLeft/onToggleRight`；TabContent 對應簡化（SessionPool 等 caller 同步）

## Impact

- Affected：ChatView、ChatBreadcrumb（刪）、ResumeButton（刪，含 resumeRoute util 若無他用）、TabContent、SessionPane、SessionPool
- 測試遷移：ChatBreadcrumb.test（刪）、tab-identity ④（breadcrumb project 名→pane header/statusline）、PaneLeafContent/GapFixes（Toggle right pane 按鈕——label 不變、位置改 pane header）、ChatView.test、render-with-workspace harness（若依賴 breadcrumb）
- 風險：ResumeButton 移除是功能取捨（已有 picker 等價入口）；resumeRoute 的 replace 語意暫不在 picker 路徑
