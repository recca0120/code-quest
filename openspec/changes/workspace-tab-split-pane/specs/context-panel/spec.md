# Context Panel

## 核心概念

Session 是核心工作單位（project + worktree + branch）。Context Panel 是附著在 session pane 內的 tool panel，cwd 自動等於該 session 的 cwd，不需使用者手動指定。

與 Independent Tool Pane（進入 split tree）的差異：

| | Context Panel | Independent Tool Pane |
|---|---|---|
| 觸發 | Session pane header `[📁][🌿][📋]` | EmptyPanePicker tool 按鈕 |
| cwd | 自動跟 session | 預設 focused session cwd，可手動切換 |
| 空間佔用 | 附著在 session pane 右側 | 獨立 pane，佔 split tree 一個 leaf |
| 同時開多個 | ✗（同 session 只能一個 panel） | ✓ |
| 適合 | 快速查看自己 session 的狀態 | 並排看不同 worktree 的 diff |

## 觸發方式

Session pane header toolbar 有三個按鈕：

```
⎇ branch · session title   [📁][🌿][📋]   [⊟][⊞][×]
```

- `[📁]` → 展開 Files tab
- `[🌿]` → 展開 Git tab
- `[📋]` → 展開 Spec tab
- 再次點擊同一按鈕 → 收合 panel

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ ⎇main·Task A   [📁][🌿][📋]              [⊟][⊞][×]     │
├────────────────────────────┬─────────────────────────────┤
│                            │ [📁 Files] [🌿 Git] [📋 Spec]│
│   Chat（全寬 → 縮小）       ├─────────────────────────────┤
│                            │                             │
│                            │   （tab 內容）               │
│                            │                             │
└────────────────────────────┴─────────────────────────────┘
```

- Panel 展開時 Chat 縮小，panel 佔右側固定寬度（約 320px）
- Panel 收合時 Chat 恢復全寬
- Panel 內 tab 可切換（Files / Git / Spec）

## Git Tab

- 呼叫 `GitContext.status(cwd)` 取得 git 狀態
- 顯示：branch 名稱、clean / dirty 狀態、ahead/behind upstream（有時才顯示）
- Changed files 清單：status code（`M` / `A` / `D` / `??`）+ 檔名
- 點擊 file → 呼叫 `git:diffByCwd`，inline 顯示 diff（可折疊）
- `[↺]` 按鈕手動重整

```
🌿 Git                         [↺]
──────────────────────────────
⎇ main  ·  2 changes  ↑1

M  src/components/Foo.tsx
?? src/components/Bar.tsx
```

## Files Tab

- 呼叫 `FsContext.browse(cwd)` 取得目錄內容
- 顯示：麵包屑路徑 + 目錄清單（先）+ 檔案清單（後）
- 點擊目錄 → 導覽進入（更新 browse path）
- 麵包屑各段可點擊回上層

```
📁 Files
──────────────────────────────
app / src / components /

📁 ui/
📁 workspace/
📄 App.tsx
📄 main.tsx
```

## Spec Tab

- 呼叫 `OpenspecContext.getOpenspecList(cwd)` 取得 openspec 狀態
- 顯示 changes 清單：name + task progress（`done/total`）
- 顯示 specs 清單：capability 名稱
- 點擊 change → 顯示 tasks.md 內容（呼叫 `openspec:read`）

```
📋 Spec
──────────────────────────────
Changes
  workspace-tab-split-pane   12/15 tasks

Specs
  split-pane
  context-panel
```

## 行為規格

- **cwd 不可手動切換**：panel 的 cwd 永遠等於 session 的 cwd。要查看其他 worktree 需改用 Independent Tool Pane。
- **同一 session 只能開一個 panel**：點擊不同 toolbar 按鈕會切換 tab，不會疊開。
- **Panel 不跟著 focus 走**：即使 focus 移到其他 pane，panel 維持附著在原本的 session pane。
- **Session unmount 時 panel 也 unmount**：panel 不需 forceMount（無狀態保留需求）。
