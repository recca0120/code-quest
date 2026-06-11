# Handoff: Tmux Workspace（Code Quest 前端改版）

目標 repo：`recca0120/code-quest`，基底分支 **`feat/discuss-layout`**。
本文件自足——沒參與設計討論的開發者（或 Claude Code）應能只靠這份 README 實作。

## Overview

把 Code Quest 的 workspace 全面 tmux 化：
- **Workspace tabs**（= tmux windows）：每個 tab 一棵獨立 pane tree；**移除原本的 SessionBar**
- **Pane tree**：可水平/垂直分割、拖曳重排、拖分隔線調大小、zoom
- **Chat pane 自帶工具**：files / git / openspec 以「內建側欄＋dock」形式跟著 chat（定案＝版面 B/C 混搭，見下）
- **PanePicker**：唯一入口（⌘K）——新增 project → worktree → 開任意類型 pane（定案＝Miller 三欄）
- **Drawer / Zoom**：看完整內容的兩條路
- **RWD**：desktop 全樹／tablet 上限 2 pane／mobile 單 pane

## About the Design Files

本包內的 HTML/JSX/CSS 是 **HTML 設計稿（design reference）**，展示意圖中的外觀與行為，**不是可直接搬運的生產程式碼**。任務是在 code-quest 既有環境（React 19 + Tailwind v4 + Zustand + 既有 TabContext/PaneNode 架構）中重現這些設計，沿用 repo 既有的模式與元件。

打開 `Tmux Workspace 版面探索.html`（瀏覽器直開即可）可互動瀏覽全部畫板；`proposal/tmux-mocks.jsx` 等檔案的 JSX 結構即版面結構說明。

## Fidelity

**High-fidelity**。色彩、字級、間距、圓角、狀態皆為定案值，請以像素級重現；所有值都已 token 化（見 `tokens/App.proposal.css`，命名沿用 repo `apps/web/src/App.css` 的 `@theme` 體系，可直接替換/合併）。

## 已定案的決策

| # | 決策 |
|---|---|
| 整體版面 | **B/C 混搭**：chat pane 內建右欄（B）為桌面預設；右欄可收合（⇥），收合後變 chat 底部 **dock chips**（C）。兩者同一資料來源，只是展開狀態不同 |
| PanePicker | **乙・Miller 三欄**：Projects → Worktrees → （pane 類型 grid＋進行中＋resume 歷史） |
| 附帶工具預設 | 新 chat 預設**展開側欄**；pane 寬 < 720px 時自動收合成 dock |
| Tab 與 project | **tab 不綁定 project**（pane 可混 project）；底部狀態列永遠顯示 focused pane 的 `project ⎇ branch` |
| Drawer 方向 | 桌面/平板**右側滑入**；mobile 變 **bottom sheet**（三段） |
| Tab 命名 | 預設＝第一個 pane 的 worktree 名（去 `feat/` 等前綴）；雙擊改名（沿用現有 rename 機制）；tab 上有 busy 燈（任一 pane busy 即亮） |
| 常用組合 | 做一組：「標準工作組」＝ chat＋files＋git（picker 第三欄底部，⌘1） |
| Session bar | **移除**。busy 狀態改由 tab 燈＋狀態列 `N busy` 承接 |

## Screens / Views

### 1. Workspace 外框
- **頂部 tab bar**：高 38px，背景 `--color-surface`，底線 1px `--color-border`
  - 左：logo（18px 圓角 4px 方塊 `--color-accent`＋「Code Quest」13px/700）
  - tabs：高 32px、圓角 8 8 0 0、active＝`--color-bg` 底＋邊框＋底部 2px 蓋線接縫；內容＝編號（mono 10px，active 時 `--color-accent`）＋busy 燈（6px 圓點 `--color-accent`，pulse 1.2s）＋名稱＋×；**全部 `white-space: nowrap`**
  - 右：⊞ Session Manager（⌘⇧M）、⌘K 鍵帽、⚙、＋ Project（production 增補：onboarding 直達入口）
- **底部狀態列**：高 26px，`--color-surface` 底、頂線 1px；mono 10.5px
  - 左：project 名（accent 色、600）＋ `⎇ branch`
  - 右：快捷鍵提示（⌘K picker／⌘D 垂直分割／⌘⇧D 水平分割／⌘⇧Z zoom）＋ `N busy`＋busy 燈
- **pane 區**：`padding/gap: 6px`，背景 `--color-bg`

### 2. Pane（共通殼）
- 圓角 10px、邊框 1px `--color-border`、超出裁切
- **focused**：邊框 `accent 55%`＋外圈 1px `accent 35%`；permission mode 換色（plan＝`--color-info`、bypass＝`--color-danger`）
- 非 focus pane 內容 `opacity: 0.75`
- **header** 高 30px：編號徽章（16×16、圓角 4、mono 10px/700；focused＝accent 底白字）＋類型 icon＋標題（12px/600）＋meta（mono 10px）＋右側動作 `◫ ⬓ ⤢ ×`
- 最小尺寸：寬 320 / 高 160（低於下限 → 拒絕分割並 toast 提示）

### 3. Chat pane（B/C 混搭）
- **內建側欄**（展開態）：寬 218px、左線 1px、`--color-surface` 底
  - 頂部三分頁：`▤ files·N`／`± git·+N`／`◈ spec·N`，11px，active 底線 2px accent；右側 ⇥ 收合鈕
  - 底部 hint 列：「⤢ 點項目開 drawer　⌘⏎ 升級成 pane」（10px `--color-text-dim`）
- **dock**（收合態）：chat 底部一列 chips——圓 pill、高 28px、11px；count 徽章 mono 9.5px accent；active chip＝accent-soft 底＋accent 邊框；右端 hint「點 chip 開 drawer・⌘⏎ 升級成 pane」
- 訊息區/composer 沿用現有 ChatShell；composer 邊框吃 mode accent

### 4. PanePicker（Miller 三欄，⌘K）
- modal 置中，寬 980px（窄視窗 560px 單欄退化），圓角 14、陰影 `--shadow-floating`
- 頂部搜尋列；底部鍵位列：「←→ 換欄／↑↓ 移動／⏎ 開啟到目前 pane／⌘⏎ 分割開啟」
- 欄 1 **Projects**（flex 4）：列＝⌂＋名稱＋`N⎇`；底部「＋ 新增 Project…」
- 欄 2 **Worktrees**（flex 5）：⎇＋branch（mono）＋`N chats・busy`；底部「＋ 新增 worktree…」
- 欄 3（flex 6）：**新增 pane** 類型 grid（3 欄卡片：icon＋名稱＋快捷字母 F/G/O/D/T）→ **進行中**（busy 標示＋所在 pane 編號）→ **歷史 resume**（⟲＋相對時間）→ 底部**常用組合**「標準工作組 chat＋files＋git（⌘1）」；另有 ⬆ Import…（production 既有功能保留）
- 列高 ≥ 28px、active 列＝`--color-selected` 底＋accent glyph

### 5. Drawer（桌面完整內容）
- 右側滑入，寬 56%（min 480px）、左緣 6px 拖拉把手（中央 44px 把手條）
- header：類型 icon＋完整路徑（mono 12px/600）＋diffstat＋動作：**「⊞ 釘選成 pane」（primary）**、「⤢ 全螢幕」、✕
- footer hint：「esc 關閉／拖左緣調寬度／釘選後成為 pane tree 的新 leaf」
- 背後遮罩：`--color-bg` 45% 透明，點擊關閉
- **釘選**＝把 drawer 的 content descriptor 轉成 pane tree 新 leaf（在 focused pane 右側垂直分割）

### 6. Zoom
- 任意 pane ⌘⇧Z → 暫時佔滿 pane 區；頂部出現 zoom bar（accent-soft 底）：「⤢ Zoom 中 — pane ② …（共 N 個 pane）」＋「⌘⇧Z 或 esc 返回」；header 顯示 ⤢ 徽章

### 7. 拖曳重排
- 抓 pane header 拖起 → ghost（原 pane 縮影、旋轉 -1.5°、陰影、opacity .92）
- 目標 pane 浮出 **5 個落點**：上/下/左/右（該方向分割）＋中央（置換）；落點＝2px 虛線 accent 55%＋accent-soft 底；命中＝實線＋accent 25% 底
- 分隔線：視覺 1px、熱區 6px；hover 顯把手（accent）＋游標 col/row-resize；拖曳即時 reflow；雙擊回 50%；focused pane 可用 ⌥方向鍵微調

### 8. RWD
- **tablet（640–1024）**：同時可見 pane 上限 2；超出的收成右側 34px 直立 tab 條（writing-mode: vertical-rl），點了與目前 pane 交換（production 採 focused 衍生可見集合：點條＝帶進視野，偏離「交換」定案——決策 2026-06-11）。直向：單 pane＋slide-over 浮層（寬 58%，拖到底固定成分割）。保留拖曳
- **mobile（<640）**：單 pane 全幅；頂列＝tab 下拉＋pane 數字 ①②③（22px）＋⊞ 切換器；底部 dock chips（高 40px）；左右滑切 pane；**不提供分割與拖曳**；drawer → bottom sheet（snap 0/66%/100%，grabber 44×5）；pane tree 攤平成**卡片牆切換器**（2 欄、卡 190px 高、active 卡 accent 框）；composer 輸入字 16px（防 iOS 聚焦縮放）；dock/sheet 加 `env(safe-area-inset-bottom)`
- **核心原則：斷點切換不銷毀 pane tree，只改變同時渲染數；回桌面原樹還原**

## Interactions & Behavior（快捷鍵協定）

| 鍵 | 行為 |
|---|---|
| ⌘K | PanePicker |
| ⌘D / ⌘⇧D | focused pane 垂直 / 水平分割（開 picker 選內容） |
| ⌘⇧Z 或 esc | zoom / 取消 |
| ⏎ / ⌘⏎（picker 內） | 開啟到目前 pane / 分割開啟 |
| 1–9 | （按住 pane-jump 鍵時）跳到該編號 pane |
| ⌥方向鍵 | 微調 focused pane 邊界 |
| ⌘⇧M | Session Manager |

動效：hover/focus `120ms`；pane 開合與重排 `200ms`；drawer/sheet `240ms`；easing `cubic-bezier(.2,.8,.2,1)`；`prefers-reduced-motion` 時全部關閉。

## State Management（對應 repo 既有架構）

- `WorkspaceTab[]`：沿用 `useWorkspaceTab`；每 tab 持有 `paneRoot: PaneNode`（既有型別），新增 `label` 預設規則（worktree 名）
- `PaneNode` leaf content 擴充為 **descriptor**：`{ type: 'chat'|'files'|'git'|'openspec'|'diff'|'terminal', cwd, params }`——**pane 類型 registry**：picker 類型清單、dock chips、drawer「釘選成 pane」都從 registry 讀；新增 terminal 等只要註冊一筆
- chat pane 附帶工具狀態：`{ railOpen: boolean, railTab: 'files'|'git'|'spec' }` 存於 pane 內部 state（per-pane，persist）
- drawer：全域單例 `{ descriptor, width } | null`；釘選＝呼叫既有 `setContentInPane` 的分割版
- RWD：以 viewport 寬計算 `maxVisiblePanes`（1/2/∞）；被收納的 pane 只是不渲染，state 保留
- SessionBar 元件與相關 `maxVisible`/overflow 邏輯刪除；busy 聚合移至 tab（既有 `collectSessionsInPaneTree` 可直接用）

## Design Tokens

完整檔：**`tokens/App.proposal.css`**（Tailwind v4 `@theme`，可直接替換 `apps/web/src/App.css` 的 token 段）。重點：

- 色彩（V1 陶土・暗，dark 預設）：bg `#191613`／surface `#211d18`／hover `#29241e`／border `#38322a`／text 六階 `#f2ede3 #d8d2c6 #a39b8d #756d5e #5a523f #3b362c`／accent `#d97757`／success `#84b07e`／warning `#d4ab6a`／danger `#df6c55`／info `#82a3c9`；light 對應（紙・亮）在同檔
- 字體：Outfit／JetBrains Mono；body 13、ui 12、label 10/700/+12%、code 11.5、statusline 10.5（production 採 repo 可及性字級體系——`--text-xs` 14px＋字級軸——為有意偏離）
- radius：4 / 7 / 10 / 14 / 16(sheet) / 99(pill)；spacing 4px 基準
- pane：header 30、gap 6、min 320×160、group stripe 3px、dim .75
- z-index 沿用 repo 既有 tiers（float 30＝drawer/sheet、overlay 40、modal 50＝picker）
- motion：120/200/240ms＋`cubic-bezier(.2,.8,.2,1)`
- RWD：breakpoint sm 640／lg 1024、hit-min 44、input 16px、safe-area

## Assets

無外部圖像資產。icon 皆為文字 glyph（◫ ⬓ ⤢ ▤ ± ◈ ❯ ⎇ ✦ ⊞），實作時建議換成 repo 既用的 heroicons 對應款。字體 Outfit＋JetBrains Mono（Google Fonts，repo 已使用）。

## Files（本包內容）

| 檔案 | 內容 |
|---|---|
| `Tmux Workspace 版面探索.html` | 互動畫布（瀏覽器直開）：00 tokens／01 版面 A/B/C／02 picker／03 drawer+zoom／04 拖曳／05 RWD |
| `tokens/App.proposal.css` | ★ 可落地的完整 token 檔 |
| `proposal/tokens.css` | 設計稿用主題變數＋workspace mock 樣式 |
| `proposal/tmux.css` | pane/tab/drawer/dock/picker/RWD 設計稿樣式（量測值來源） |
| `proposal/tmux-mocks.jsx` | 版面 A/B/C 結構（B/C＝定案混搭的兩個狀態） |
| `proposal/tmux-details.jsx` | picker 三案（乙＝定案）、zoom、拖曳、divider/registry |
| `proposal/tmux-rwd.jsx`／`tmux-rwd-tokens.jsx` | RWD 五畫板＋RWD token 表 |
| `proposal/tmux-tokens-full.jsx`／`token-sheet.jsx` | 元件 token 總表／色彩表 |
| `lib/design-canvas.jsx` | 畫布外殼（僅供 HTML 瀏覽用，與實作無關） |

## 建議的 CLAUDE.md 追加段落（貼進 repo 根目錄 CLAUDE.md）

```markdown
## UI 設計規範
- Workspace 改版的設計規格在 docs/design/design_handoff_tmux_workspace/README.md，動 UI 前先讀
- Design tokens 以 docs/design/design_handoff_tmux_workspace/tokens/App.proposal.css 為準（取代 App.css @theme 段）
- 心智模型：workspace tab = tmux window、pane tree 可分割/拖曳/zoom、PanePicker 是唯一內容入口、無 session bar
```
