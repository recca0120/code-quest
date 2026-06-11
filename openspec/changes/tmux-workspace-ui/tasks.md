# Tmux Workspace UI — Tasks

TDD：每項先 [test] 後 [impl]。測試一律照 design.md §3（fake-summoner 全真寫法）；jsdom 不可及的列入該階段 Playwright 驗收。每階段結尾：全套 vitest 綠＋biome＋tsc＋（P1 起）驗收腳本。

## 0. P0 — Design tokens（行為零變）

- [x] 0.1 [impl] App.proposal.css 替換 App.css @theme 段（保留短別名；--color-toggle/--color-button consumer 改 accent/info）
- [x] 0.2 [impl] 元件/motion/RWD tokens 併入；prefers-reduced-motion 全關動效
- [x] 0.3 [verify] 全套件綠＋主要畫面 Playwright 截圖無版崩

## 1. P1 — Workspace chrome

- [x] 1.1 [test] tab busy 燈：pushServerEvent('session:states') 推 busy → tab 亮燈；結束熄滅（collectSessionsInPaneTree 聚合）
- [x] 1.2 [impl] WorkspaceTabBar 重做（編號＋busy 燈＋nowrap＋⌘K 鍵帽＋⚙；handoff §1 量測值）
- [x] 1.3 [test] tab 單擊切換（含 label 區，修 6.7 bug）＋雙擊 rename；真 UI click/dblClick
- [x] 1.4 [impl] label 單擊冒泡修正＋雙擊進編輯
- [x] 1.5 [test] tab 預設命名＝worktree 名去前綴；已命名/還原 label 不覆寫
- [x] 1.6 [impl] createNewTab/label 規則＋migration 保護
- [x] 1.7 [test] 狀態列：focused pane 切換 → project ⎇ branch 更新（useWorktreeLookup priming）；N busy 聚合
- [x] 1.8 [impl] WorkspaceStatusline（quick-hint 與 KeyboardShortcutsProvider 單一來源）
- [x] 1.9 [test+impl] SessionBar 移除：行為測試等價遷移（busy 可見性→1.1/1.7；切換入口→picker/manager），刪元件＋overflow 邏輯＋舊測試
- [x] 1.10 [verify] Playwright：tab bar/狀態列渲染、busy pulse、無 SessionBar

## 2. P2 — PanePicker Miller 三欄

- [x] 2.1 [test] 三欄資料源：projects/worktrees priming → 欄聯動；listing 載入中 loading 態（6.5）
- [x] 2.2 [impl] Miller 三欄版面（窄視窗單欄退化）；registry 類型 grid
- [x] 2.3 [test] 鍵盤協定：←→↑↓/⏎/⌘⏎/F G O D T/esc/搜尋過濾（user.keyboard 全程）
- [x] 2.4 [impl] 鍵盤導航 state machine
- [x] 2.5 [test] ⏎ 開到 focused pane（setContentInPane）；⌘⏎ 分割開啟（min-size 拒絕 toast 移至 4.1 與 DnD 護欄同源實作）
- [x] 2.6 [impl] 開啟路徑接線
- [x] 2.7 [test] 進行中（busy＋pane 編號）/resume 歷史/常用組合 ⌘1 → 3-pane 預組
- [x] 2.8 [impl] 欄3 sections＋標準工作組
- [x] 2.9 [verify] Playwright：⌘K 全鍵盤開 pane journey

## 3. P3 — Chat rail/dock ＋ Drawer

- [ ] 3.1 [test] rail 三分頁渲染（per-worktree 資料 priming：git/fs/openspec）＋count 徽章
- [ ] 3.2 [impl] PaneRail（218px、三分頁、hint 列）
- [ ] 3.3 [test] ⇥ 收合 ↔ dock chips 還原（同資料源、count 一致）
- [ ] 3.4 [impl] PaneDock chips
- [ ] 3.5 [test] params.railOpen/railTab persist roundtrip（layout save→sync→還原；schema optional 欄位＋缺省）
- [ ] 3.6 [impl] wire schema params 演進＋migration 缺省
- [ ] 3.7 [test] <720px 自動收合（ResizeObserver fake）；不自動展開
- [ ] 3.8 [impl] pane ResizeObserver
- [ ] 3.9 [test] drawer 單例開/關/esc/遮罩；釘選成 pane＝右側 split＋drawer 關閉＋debounce save
- [ ] 3.10 [impl] DrawerHost＋pin（registry 轉 descriptor）
- [ ] 3.11 [test] ⌘⏎ rail 分頁升級成 pane
- [ ] 3.12 [impl] 升級路徑
- [ ] 3.13 [verify] Playwright：drawer 滑入/拖寬、rail 收合動效

## 4. P4 — DnD 五落點 ＋ divider 強化

- [ ] 4.1 [test] 五落點分發：四方向→split+移入（含樹收斂）、中央→swap；min-size 拒絕→落點 disabled
- [ ] 4.2 [impl] DropZones＋reducer action
- [ ] 4.3 [test] divider 雙擊回 50%＋存檔；⌥方向鍵微調 focused pane 邊界
- [ ] 4.4 [impl] divider/keyboard 接線
- [ ] 4.5 [test] zoom bar 渲染（pane 編號/標題/N）＋esc 解除（優先序：picker/drawer 先吃 esc）
- [ ] 4.6 [impl] ZoomBar＋esc 協定
- [ ] 4.7 [verify] Playwright：ghost 視覺、實拖 divider reflow、五落點 hover

## 5. P5 — RWD

- [ ] 5.1 [test] visiblePaneIds 推導（zoom > cap > all；fake-match-media 三斷點）；收納不銷毀（session 保活、回桌面還原）
- [ ] 5.2 [impl] visiblePaneIds 機制（推廣既有 solo rendering）
- [ ] 5.3 [test] tablet：直立 tab 條交換；直向 slide-over
- [ ] 5.4 [impl] tablet 版面
- [ ] 5.5 [test] mobile：單 pane＋卡片牆切換＋左右滑＋無分割/拖曳；bottom sheet snap
- [ ] 5.6 [impl] mobile 版面（16px composer、safe-area）
- [ ] 5.7 [verify] Playwright：三斷點截圖、縮放往返 state 保留

## 6. 收尾

- [ ] 6.1 [verify] handoff 像素級對照（量測值 vs App.proposal.css token）
- [ ] 6.2 [verify] 全套件＋驗收腳本 10 步全綠；knip/biome/tsc
- [ ] 6.3 [opsx] specs 同步至實際行為（如有偏差先回 spec 討論）
