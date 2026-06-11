## Why

Handoff §State 定案：PaneNode content descriptor 應支援 `diff` 和 `terminal` 類型。pane-registry.ts 已有 `// 未來：diff/terminal` 佔位。這是使 workspace 從「聊天＋工具檢視」進化為「完整開發環境」的關鍵步驟。

## What Changes

### Diff Pane
- 在 pane 內顯示檔案差異（git diff output）
- DiffView 元件（Monaco diff editor 或輕量自建 side-by-side/inline view）
- registry 註冊：key `diff`、hotkey `D`、icon 待定
- 支援從 git pane「查看 diff」動作開啟

### Terminal Pane
- 在 pane 內開啟終端機（shell）
- 前端：xterm.js + fit addon
- 後端：server 端 PTY spawning（node-pty），透過 WebSocket channel 串流 stdin/stdout
- registry 註冊：key `terminal`、hotkey `T`、icon 待定
- 支援指定 cwd 開啟

## Scope

- PaneContent type 擴充（`diff` | `terminal`）
- pane-registry 新增兩筆
- DiffView 前端元件
- TerminalView 前端元件 + xterm.js 整合
- Server 端 PTY handler（socket event: `terminal:spawn` / `terminal:data` / `terminal:resize`）
- Server 端 diff handler（socket event: `git:diff`，可能沿用既有 git handler）

## Out of Scope

- Diff review 功能（comment、approve）
- Terminal multiplexing（tmux-in-tmux）
- Terminal theming（先用 xterm 預設 + data-theme 對應）

## Dependencies

- **後端**：node-pty 套件安裝 + PTY handler 實作
- **前端**：xterm.js + @xterm/addon-fit 套件安裝
- Git diff 可能可沿用既有 `git:status` / `git:diff` server handler

## Risk

- node-pty 是 native module，需 rebuild per platform；CI 需確認
- Terminal resize 與 pane resize 的 fit 同步可能需要 ResizeObserver
