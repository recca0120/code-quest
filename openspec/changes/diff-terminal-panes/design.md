# Diff / Terminal Panes — Design

## Registry 擴充

```typescript
// pane-registry.ts 新增
{ key: 'diff',     icon: '⇄', label: 'diff',     hotkey: 'D', makeContent: ... }
{ key: 'terminal', icon: '❯', label: 'terminal', hotkey: 'T', makeContent: ... }
```

PaneContent type 擴充：
```typescript
| { type: 'diff'; target: { kind: 'fixed'; cwd: string }; file?: string }
| { type: 'terminal'; target: { kind: 'fixed'; cwd: string }; pid?: number }
```

## DiffView 元件

兩種實作方案（選一）：

### 方案 A：Monaco Diff Editor
- `@monaco-editor/react` 的 `DiffEditor` 元件
- 優點：語法高亮、inline/side-by-side 切換
- 缺點：bundle size 大（~2MB），需 lazy load

### 方案 B：輕量自建
- 用 `diff` npm package parse unified diff
- 自建 `<DiffLine>` 元件（add=green bg、delete=red bg、context=default）
- 優點：輕量、完全控制樣式
- 缺點：無語法高亮

建議：先用方案 B 做 MVP，確認 pane 整合正確後再考慮升級 Monaco。

### 資料流

```
git pane "View Diff" → open diff pane(cwd, file)
  → socket emit 'git:diff' { cwd, file }
  → server runs git diff
  → socket response { diff: string }
  → DiffView parse + render
```

## Terminal 元件

### 前端
```
TerminalView
├── xterm.js Terminal instance
├── @xterm/addon-fit（resize 同步）
└── WebSocket data channel
```

### 後端
```
terminal:spawn { cwd } → server spawns PTY → returns { pid }
terminal:data { pid, data } ↔ 雙向 stdin/stdout
terminal:resize { pid, cols, rows }
terminal:kill { pid }
```

### PTY 生命週期
- spawn 時綁定 channelId + pid
- channel disconnect → graceful kill（SIGHUP）
- pane close → terminal:kill

### Resize 同步
- PaneLeaf 內嵌 ResizeObserver
- 尺寸變化 → xterm.fit() → terminal:resize 通知 server PTY

## 不動的

- 既有 pane 類型（chat/files/git/openspec）
- PaneShell / PaneToolbar 共通殼
- PanePicker 類型 grid（registry 驅動，自動出現新類型）
