## Context

目前左側導航（ProjectTree + WorktreeChildList）混合了三個職責：Project 管理、Worktree/Branch 操作、以及隱式的 Session 導航（藉由 context menu "Open in new chat"）。Session 切換由頂部水平 TabBar 負責，但 TabBar 無法清楚表達 worktree 歸屬，且多 session 時空間不足。Worktree/Project 的操作全藏在右鍵 context menu 和 hover-only 按鈕，mobile/tablet 無法觸及。

## Goals / Non-Goals

**Goals:**
- 左側三層結構：Project → Worktree（含 git 摘要）→ Session（作為 tab switcher）
- 廢除 TabBar，session 切換移入左側
- 所有操作改為 inline `[⋯]` button，mobile 觸發 BottomSheet
- Chat Area header 改為 breadcrumb bar（project / branch / session title）
- GitPane 移除 BranchSection，branch 切換統一由左側 Worktree `[⋯]` 負責

**Non-Goals:**
- 不實作 session 拖曳排序
- 不改變 session 的底層資料模型（channelId、cwd 等）
- 不改變 RightPane（Files / Spec）的內容與行為
- 不實作 worktree 的 inline git diff 展開

## Decisions

### 1. TabBar 廢除，Session row 成為 tab switcher

**決定**：廢除 `TabBar` component，左側 Session row 點擊直接切換 active session。

**理由**：TabBar 與左側 Session 列表功能重疊。垂直的 Session 列表有更多空間顯示 worktree 歸屬，且 mobile 的 sidebar drawer 自然相容。

**`forceMount` 保留**：`TabContainer` 現有的 `Tabs.Content forceMount` + CSS `hidden` 機制原封不動保留，session 的 React state（compose draft、scroll 等）繼續不因切換而丟失。TabBar 廢除，但 `Tabs.Root` + `Tabs.Content` 繼續使用，只是改由左側 row 觸發 `setActiveTab`。

**替代方案捨棄**：保留 TabBar + 左側加 Session — 兩個地方都是 tab switcher，使用者需要學習兩套入口。

### 2. BottomSheet 觸發條件：breakpoint-driven

**決定**：`useBreakpoint().isDesktop` 為 true 時 `[⋯]` 開 Radix Dropdown；false 時開 BottomSheet。同一個 `menuCallbacks` 物件傳入兩者。

**理由**：操作邏輯（rename/archive/delete 等）與呈現方式解耦。BottomSheet 只是 Dropdown 在 mobile 的替換呈現層，不改變 action handler。

**BottomSheet 實作**：使用 Radix `Dialog`（`vaul` library 不引入，避免增加依賴）。固定在螢幕底部，含 drag handle 視覺提示（純裝飾，不實作拖曳關閉）。Overlay 點擊關閉。

### 3. Session 層顯示來源

**決定**：Session 列表從 `useSession().sessions` filter by `projectRoot === project.cwd` AND `cwd === worktree.path`，對應至各 worktree 下。

**「未關聯 worktree」的 session 處理**：`cwd === projectRoot` 或 `cwd === undefined` 的 session 顯示在 main worktree 下（listing 的第一個 entry，即 `path === projectCwd` 的 worktree）。

**Exited session**：`state === 'exited'` 的 session 不顯示在左側（避免噪音）；可從 Session history popover 找到。

### 4. Chat breadcrumb 資料來源

**決定**：breadcrumb 顯示 `activeProjectName / worktreeBranch / sessionTitle`，從 `useTabState().tabs[activeTabId]` 和 `useGitState()` 取得。

**無 cwd 的 session**：只顯示 `projectName / sessionTitle`，branch 部分省略。

### 5. GitPane 的 BranchSection 移除

**決定**：直接刪除 `BranchSection` component 及其在 `GitPane` 的使用。branch 切換的唯一入口改為左側 Worktree `[⋯]` → "Switch branch"。

**影響**：`GitPane.test.tsx` 中測試 BranchSection 的 cases 一併刪除（行為消失，不反轉 assertion）。

### 6. renderWithWorkspace 更新

**決定**：`renderWithWorkspace` helper 的 `launchSession` 改為點擊左側 sidebar 的 `[+]` 按鈕（worktree row）而非 TabBar 的 `New tab`。

**影響**：`WorkspaceLayout.test.tsx` 中所有依賴 `New tab` button 和 `tab-bar` role 的測試需要更新，改用左側 session row 的 aria-label 查詢。

## Risks / Trade-offs

- **[風險] WorkspaceLayout.test.tsx 大量測試需改寫** → 集中在一次 PR 內完成，不分批（避免測試與實作不同步）
- **[風險] renderWithWorkspace 改動影響所有 integration test** → 先改 helper，再跑全部測試確認，再繼續
- **[Trade-off] BottomSheet 不支援拖曳關閉** → 用 overlay 點擊關閉替代，實作簡單，未來可升級 vaul
- **[Trade-off] Exited session 不在左側顯示** → 使用者需靠 Session history popover 找歷史，但減少左側噪音

## Migration Plan

1. 新增 `BottomSheet` component（有獨立測試，不破壞現有）
2. 新增 `ChatBreadcrumb` component（有獨立測試）
3. 修改 `WorktreeRow` + `WorktreeChildList` — 加 `[+]` / `[⋯]`，加 Session layer
4. 修改 `TabContainer` — 移除 TabBar，改由左側控制
5. 修改 `ChatView` — header 換成 `ChatBreadcrumb`
6. 修改 `GitPane` — 刪除 `BranchSection`
7. 更新測試：`TabBar.test.tsx` 刪除，`WorkspaceLayout.test.tsx` 大規模改寫，`renderWithWorkspace` helper 更新
8. 刪除 `TabBar.tsx`（最後一步，確保測試全綠再刪）

## Open Questions

~~Session history popover（`☰` 按鈕）要放哪裡？~~ → 已決定：移至 ChatBreadcrumb 左側 actions 區。

## Post-implementation Polish（第二輪）

以下為實作後觀察到的 UX 問題，列為後續修正範圍。

### A. Worktree 名稱截斷

**問題**：Worktree 名稱過長（如 `worktree-perf-commission-batch`、UUID 尾碼 `worktree-agent-adf24b45165face45`）導致換行，視覺混亂。

**決定**：在 `WorktreeRow` 中使用「中間截斷 + tooltip」策略。
- `midTruncate(str, maxLen = 22)` — 保留前 14 字元 + `…` + 後 6 字元
- 短名（≤ maxLen）不截斷
- `title={wt.name}` 提供完整名稱 tooltip

### B. 移除 wt badge

**問題**：`ProjectCard` 顯示 `{n}wt`（worktree 數量 badge），但左側已展開顯示所有 worktree，數量一眼可見，badge 為冗餘資訊。

**決定**：移除 `worktreeCount` prop 及相關渲染。

### C. Project context menu — 補 "Copy path"

**問題**：Worktree context menu 有 "Copy path"，Project 沒有，不對稱。

**決定**：Project context menu 加入 "Copy path"（`navigator.clipboard.writeText(cwd)`）。

### D. 文字修正

| 原文 | 修正 | 理由 |
|------|------|------|
| "Resume session…" | "Open past session…" | 行為是列出歷史 session 供選擇，不是直接恢復 |
| "Open here (switch)" | "Open here" | "(switch)" 說明多餘，使用者已知這是切換行為 |

### E. Worktree context menu — 加 "Switch branch…"

**問題**：切換分支目前只能靠點 branch badge 觸發 BranchPopover，badge 小且不明顯，可發現性低。

**決定**：Worktree context menu（Dropdown + BottomSheet）加入 "Switch branch…" 項目，觸發同一個 BranchPopover。

### F. Archive vs Delete 語意說明

**問題**：Archive 和 Delete 差異對使用者不透明（Archive = keep branch + remove directory；Delete = force remove）。

**決定**：在 `ArchiveWorktreeConfirmDialog` 和 `RemoveWorktreeConfirmDialog` 的說明文字中明確標示差異。menu item 本身名稱不變。
