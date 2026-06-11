# Diff / Terminal Panes — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline＋priming＋UI 驅動＋多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. PaneContent 型別擴充

- [ ] 1.1 [test+impl] PaneContent union 加 diff / terminal 類型；PaneTypeEntry key 擴充
- [ ] 1.2 [test+impl] pane-registry 註冊 diff（hotkey D）+ terminal（hotkey T）

## 2. DiffView（輕量 MVP）

- [ ] 2.1 [test] DiffView 元件：給定 unified diff string → 渲染 add/delete/context 行
- [ ] 2.2 [impl] DiffView + diff line parser
- [ ] 2.3 [test] DiffPane：開啟 diff pane → socket emit git:diff → 渲染 DiffView
- [ ] 2.4 [impl] DiffPane 接線（PaneShell + WorktreeSwitcher + socket request）

## 3. Server — git:diff handler

- [ ] 3.1 [test] git:diff handler：收到 { cwd, file } → 回傳 { diff: string }
- [ ] 3.2 [impl] git:diff server handler（exec git diff）

## 4. TerminalView（xterm.js）

- [ ] 4.1 [setup] 安裝 xterm.js + @xterm/addon-fit
- [ ] 4.2 [test] TerminalView 元件：mount → 建立 xterm instance → 顯示 terminal 容器
- [ ] 4.3 [impl] TerminalView + xterm 初始化 + fit addon

## 5. Server — PTY handler

- [ ] 5.1 [setup] 安裝 node-pty
- [ ] 5.2 [test] terminal:spawn handler：收到 { cwd } → 建立 PTY → 回傳 { pid }
- [ ] 5.3 [impl] PTY spawning + terminal:data 雙向串流
- [ ] 5.4 [test] terminal:resize handler：收到 { pid, cols, rows } → resize PTY
- [ ] 5.5 [impl] PTY resize + kill lifecycle

## 6. 前端 Terminal 接線

- [ ] 6.1 [test] TerminalPane：開啟 → spawn → xterm 接收 data
- [ ] 6.2 [impl] TerminalPane 接線（PaneShell + socket events + fit resize）

## 7. 收尾

- [ ] 7.1 [test] PanePicker 類型 grid 自動顯示 diff + terminal 卡片
- [ ] 7.2 [verify] 全套綠 + 手動驗證 diff / terminal pane
