# Tmux Workspace UI — Design

> 權威來源：`docs/design/README.md`（handoff，像素級定案值）＋`docs/design/tokens/App.proposal.css`（token 檔）＋`docs/design/proposal/*.jsx`（版面結構參考）。本文件記錄「如何落在 repo 既有架構」的決策，量測值不重抄——以 handoff 為準。

## 1. 架構對應（handoff State Management → repo 現況）

| Handoff 概念 | Repo 對應 | 動作 |
|---|---|---|
| `WorkspaceTab[]` + label 預設規則 | `TabContext` workspace tabs（已有 rename） | label 預設改「第一個 pane 的 worktree 名去前綴」；busy 燈聚合用既有 `collectSessionsInPaneTree` |
| leaf content descriptor `{ type, cwd, params }` | `PaneContent` union＋wire codecs（已有 session/git/files/openspec/worktrees） | 擴充 registry 模組：`PANE_TYPE_REGISTRY`（icon、標題、快捷字母、建構 descriptor）；新增 `terminal`/`diff` 為 registry 條目（實作可後置，registry 先承載既有五種） |
| chat 附帶工具 `{ railOpen, railTab }` per-pane persist | 無 | 放進 leaf content 的 `params`（wire schema v2 已能載 per-leaf 欄位）；migration：缺省 = `railOpen: true, railTab: 'files'` |
| drawer 全域單例 `{ descriptor, width } \| null` | 無 | `WorkspaceLayoutContext` 新 state（不 persist——drawer 是暫態檢視）；釘選＝`splitPaneAndAssign(focusedPaneId, 'v', descriptor)` 既有 action |
| RWD `maxVisiblePanes` | 無（mobile 已有部分 solo 邏輯） | viewport 寬推導 1/2/∞；**收納＝不渲染，state 不動**（同 zoom 的 solo rendering 模式，已驗證） |
| SessionBar 刪除 | `SessionBar`/`SessionBarOverflow`＋`maxVisible` 邏輯 | 元件與測試一併刪；busy 改 tab 燈＋狀態列 `N busy` |

## 2. 關鍵決策

### D1. Rail/dock 是 chat pane 內部結構，不進 pane tree
B/C 混搭 = 同一資料源（per-worktree 的 files/git/spec 狀態，從既有 GitProvider/FsProvider/OpenspecProvider 讀）兩種展開態。rail/dock 切換只改 leaf `params.railOpen`，不觸發 pane tree 結構變更 → layout save 走既有 debounce 管線。pane 寬 <720px 自動收合用 `ResizeObserver`（與 SessionBar 舊邏輯不同處：觀察的是 pane 元素不是 window）。

### D2. PanePicker 重寫為 Miller 三欄，但資料層沿用
欄 1/2 資料 = 既有 `useAvailableWorktrees`/`useWorktreeLookup`；欄 3 = registry 類型 grid＋`useSession().sessions`（進行中）＋ resume 歷史（既有 sessions:history RPC）。鍵盤協定：←→ 換欄、↑↓ 移動、⏎ 開到目前 pane、⌘⏎ 分割開啟、F/G/O/D/T 直選類型。「開到目前 pane」=`setContentInPane(focusedPaneId, descriptor)`；「分割開啟」=`splitPaneAndAssign`。常用組合「標準工作組」＝一次三個 descriptor 的預組 split。

### D3. 狀態列的 project ⎇ branch 來自 focused pane
focused leaf 的 `cwd` → `useWorktreeLookup` 反查 identity（worktree-centric P1 已落地）。tab 不綁 project 的決策已成立（TabMeta 層面）；狀態列是顯示層補完。

### D4. 渲染收納原則（zoom／tablet／mobile 同一機制）
已有的 solo rendering（zoom 時只渲染 zoomed leaf）推廣成 `visiblePaneIds` 計算：zoom > RWD cap > 全部。被收納 pane 不 unmount session（SessionPool 既有保活機制），只是不在 PaneTree 輸出。**這是 RWD 不銷毀樹的實作核心。**

### D5. DnD 五落點
既有 swap（中央置換）保留；新增四方向落點 = `splitPane(direction, position) + 移動 source content`。落點 hit-test 在 drop target 內以區域百分比劃分（上下 24%、左右 26%、中央其餘）。jsdom 可測 reducer 與 drop handler 分發；視覺 ghost/hover 由 Playwright 驗收。

### D6. 漸進交付，每階段可獨立上線
P0 tokens（純 CSS，行為零變）→ P1 chrome（tab bar＋狀態列＋SessionBar 移除）→ P2 picker → P3 rail/dock＋drawer → P4 DnD/divider 強化 → P5 RWD。P1 起每階段結尾跑 Playwright 驗收腳本。

## 3. 測試寫法（必遵循）

依 `fake-summoner-client` skill＋main 全真寫法調查（2026-06-11）：

1. **全真 pipeline 預設**：`createTestContainer()` → `createFakeServer(container)` → `createFakeSummoner(server)` → `renderWithWorkspace({ summoner })`；中型切片用最小真 provider stack（標竿：`layout-sync-pipeline.test.tsx`）
2. **餵資料用 priming，不 `vi.mock` 自家 context**：`summoner.git()!.setProjectRoot/addWorktree`、`summoner.filesystem().setRoots/addDirectory/addFile`、`claude.prepareInit(s.init(...))`、`container.get(TYPES.ProjectStore).upsert`、`seedLayout(container, layout)`
3. **驅動走真 UI**：`user.click`/`user.keyboard`（⌘K＝`'{Meta>}k{/Meta}'`、⌘⇧Z zoom）；probe 只做 arrange
4. **多層驗證**：UI（role 優先）＋`summoner.sentEvents()`＋container store＋`claude.received()`
5. **heavy view 不 mock**（ChatView 走 `renderWithChannel` 真渲染）；可 mock 僅第三方重型庫
6. **jsdom 測不到的**（ghost 視覺、divider 拖曳座標、bottom sheet 慣性）→ Playwright 驗收腳本（`/tmp/acceptance.mjs` 模式：`MOCK_CLI=true SUMMONER_MODE=local pnpm dev:local`），其 DOM 斷言以 testid 契約為準
7. **testid 是 spec 級契約**：新增 `workspace-statusline`、`pane-rail`、`pane-dock-chip-*`、`pane-picker-col-*`、`drawer-pin`、`zoom-bar`、`drop-zone-{top,bottom,left,right,center}`；沿用 `pane-header`、`split-pane-leaf`、`workspace-tab*`
8. **RWD 測試**：`@/test/fake-match-media` 的 setup helper，斷言 visiblePaneIds 的 DOM 結果（leaf 數），不斷言 CSS

## 4. 注意事項（風險與陷阱）

- **SessionBar 移除順序**：先讓 tab busy 燈＋狀態列上線（P1），同 PR 刪 SessionBar——避免 busy 狀態無處可看的中間態
- **rail params 進 wire schema**：v2 schema 加 optional 欄位（向後相容），不可 bump v3；dedupe/migration 函式需同步處理
- **tab label 預設規則**改變既有「Workspace N」命名——v1→v2 migration 與既有 layout 的 label 不可被覆寫（只有未命名 tab 才套新預設）
- **min size 拒絕分割**需在 `splitPane` reducer 層擋（含 picker ⌘⏎ 路徑），不只 UI 按鈕 disable；toast 用既有 sonner
- **點 tab label 不切 tab** 的既有 bug（worktree-centric 6.7）在 P1 tab bar 重做時一併解決：單擊切換、雙擊 rename
- **永遠對照 handoff 的定案值**：間距/字級/色彩不可憑感覺，token 名以 App.proposal.css 為準；icon 文字 glyph 換 heroicons 對應款
- **`prefers-reduced-motion`** 時動效全關（token 已備）
- **狀態列快捷鍵提示**要跟 KeyboardShortcutsProvider 實際綁定一致（單一來源：從 registry/常數導出，不可手抄兩份）
- **drawer width 維持 DrawerHost local state**（暫態檢視偏好，不入 context）——決策 2026-06-11
- **尺寸 token 與 TS 常數以 TS 為權威**（`pane-min-size.ts`），CSS token 供樣式層——決策 2026-06-11

## 5. 驗證事項（每階段 DoD）

| 階段 | 自動化（vitest 全真） | Playwright 驗收 |
|---|---|---|
| P0 tokens | 既有套件全綠（token 名相容） | 截圖比對主要畫面無版崩 |
| P1 chrome | tab 燈聚合、狀態列 focused 來源、tab 單擊/雙擊、SessionBar 測試刪除＋等價遷移 | tab bar 38px/狀態列渲染、busy pulse 可見 |
| P2 picker | 三欄資料源、鍵盤協定、⏎/⌘⏎ 落點、常用組合、loading 態（worktree-centric 6.5） | ⌘K 開啟、全鍵盤走完開 pane |
| P3 rail/dock | rail 三分頁、⇥ 收合↔dock、<720px 自動收合（ResizeObserver fake）、params persist roundtrip、drawer 釘選=新 leaf | drawer 滑入動效、拖左緣調寬 |
| P4 DnD | 五落點 reducer 分發、divider 雙擊回 50%、⌥微調、min size 拒絕+toast | ghost 視覺、實拖 divider |
| P5 RWD | visiblePaneIds 1/2/∞、收納不銷毀（session 保活）、回桌面還原 | 三斷點實截圖、mobile 卡片牆 |
