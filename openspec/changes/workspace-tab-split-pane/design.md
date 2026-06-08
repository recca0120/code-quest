## Context

目前 workspace 是單 session 顯示架構：`TabContainer` 用 Radix `Tabs.Root` + `forceMount` 一次 render 所有 session，但只顯示 active 的一個。使用者需要並排查看多個 session（類似 tmux pane），以及從指定 worktree 開 session，目前 UI 都無法滿足。

使用者工作模式：`cd <dir> && claude`，用 tmux 管理多個工作 context，在同一個 claude 實例內需要：
1. 多個平行 session 同時可見（split pane）
2. 從任意 worktree 開新 session
3. Git / Files / Spec 等 tool pane 需要時才開，不固定佔用畫面空間

## Goals / Non-Goals

**Goals:**
- Split Pane：chat 區域可任意切割（左右 / 上下），任意深度，支援 resize、對調、拖拉重排
- Tool Pane：Git / Files / Spec / Worktrees 可作為 pane 類型放入 split 區域，需要時才開
- Tab = Session：Tab Bar 是 session 清單，點擊填入 focused pane，不再是 active 切換器
- Focus Model：click pane → focus
- New Session：Global Bar `[+]` 快速開 session；空白 pane picker 一站式選 session / tool / new
- Global Bar：project switcher、search、settings、new session 統一入口
- Tab：每個 tab 是獨立工作場景（類似 tmux window），有自己的 pane 排列
- Context Panel：session pane header toolbar 快速展開 Files / Git / Spec，cwd 自動跟 session
- Session Manager：overlay 總覽所有 tab / session，含最新訊息預覽、拖曳重排、tab 管理
- Mobile 退化：小螢幕強制單 pane，不顯示 split 功能

**Non-Goals:**
- 固定左側 Sidebar 或固定右側 Right Pane（改為 tool pane 進入 split area）
- 同一個 session 出現在多個 pane（不允許，點 tab 只 focus 既有 pane）
- Pane layout 持久化（layout 是臨時的，不儲存）
- 跨 Tab 的 pane 整體搬移（session 可跨 tab，但 pane 結構不跨）

## Decisions

### 1. Pane Tree 資料結構：Binary Tree，Leaf 支援多種內容類型

```typescript
type PaneContent =
  | { type: 'session';   sessionId: string | null }
  | { type: 'git';       cwd: string }
  | { type: 'files';     cwd: string }
  | { type: 'spec';      cwd: string }
  | { type: 'worktrees' }

type PaneNode =
  | { type: 'leaf';  id: string; content: PaneContent }
  | { type: 'split'; id: string; direction: 'h' | 'v'; ratio: number;
      first: PaneNode; second: PaneNode }
```

**理由**：tmux 相同模型，能表達任意切割方向與深度。tool pane 與 session pane 共用同一個 pane tree，不需要額外的固定側欄。ratio（0.0–1.0）控制兩側比例，resize 只改 ratio 不動結構。

**替代方案捨棄**：固定 Right Pane 側欄 —— 無法同時查看兩個 worktree 的 git diff，且在多 pane 情境下「跟著 focused pane」語義模糊；固定 Sidebar —— 佔用固定空間，worktree 管理「需要時才開」更符合使用習慣。

---

### 2. Pane Tree State 放在 TabContext

**決定**：`paneRoot: PaneNode`、`focusedPaneId: string` 加入現有 `TabContext`，不另開新 context。

**理由**：pane tree 與 session list（`tabs`）高度耦合——切換 session 需要同時知道 focusedPaneId 和 tabs；兩者分開 context 會造成 consumer 需要 import 兩個 context。

**替代方案捨棄**：新建 `SplitPaneContext`——需要在 `TabContainer` 以上 provide，且幾乎所有 pane 操作都需要同時讀 tabs，合併更自然。

---

### 3. forceMount 策略：所有 session 繼續 mount，pane 以外的 session 用 CSS hidden

**決定**：維持現有 `Tabs.Content forceMount` 機制。split pane 內的 session 正常顯示；不在任何 pane 的 session 繼續 render 但 `display: none`。Tool pane（git / files / spec / worktrees）不需 forceMount，開啟時 mount，關閉時 unmount。

**理由**：保留 compose draft、scroll 位置、channel state。session 從 tab bar 拖入 pane 時立即可用，不需重建。tool pane 無狀態保留需求，unmount 可釋放資源。

---

### 4. Tab Bar 與 Split Pane 是跨 Project / Worktree 的全域容器

**決定**：Tab Bar 列出所有活著的 session，不論它們屬於哪個 project 或 worktree。Split Pane 同理，不同 pane 可以顯示來自不同 project 或不同 worktree 的 session 或 tool。

```
Tab Bar 範例（混合 project / worktree）：
[● ⎇main·Task A ×]  [○ ⎇feat-X·Task B ×]  [○ other-repo/main·Task C ×]  [+]
  cc-office/main      cc-office/feat-X        other-repo/main

Split Pane 範例（session + tool 並排）：
┌──────────────────────┬───────────────────────┐
│ ⎇main · Task A       │ 🌿 Git  ⎇main ▾        │
│ （cc-office）        │ M src/foo.ts           │
│                      │ M src/bar.ts           │
└──────────────────────┴───────────────────────┘
```

**各區塊的 project 綁定關係：**

| 區塊 | Project 綁定？ | 說明 |
|---|---|---|
| Global Bar | ✓ | 顯示 active project，切換影響 new session 預設 cwd |
| Tab Bar | ✗ | 所有 session，跨 project / worktree |
| Split Pane | ✗ | 任意 session / tool pane 可並排，跨 project / worktree |
| Tool Pane | 自訂 | 各 tool pane 有自己的 cwd，由使用者在 pane header 切換 |

**理由**：使用者用 tmux 管理多個工作 context 的習慣，反映在 UI 上就是 Tab Bar 和 Split Pane 不設 project 邊界。移除固定 Sidebar 後，project context 由 Global Bar 的 active project 決定，影響 new session 的預設 cwd。

---

### 5. Tab 的三種狀態

```
Focused-active：session 在 focused pane 顯示         → 高亮外框 + accent 色
Active：        session 在某個 pane 顯示（非 focused）→ 高亮，無外框
Inactive：      session 活著，但不在任何 pane          → 灰色，無高亮
```

Tab Bar 上的 tab 反映 session 與 pane 的關係，與現在「active = 正在看的那個」不同。Inactive session 仍在 Tab Bar 可見，session 的 React 子樹持續 mount（`forceMount`），只是畫面上沒有 pane 顯示它。

---

### 6. Tab 點擊行為

```
點 tab（session inactive，未在任何 pane）→ 填入 focusedPane（替換現有 content）
點 tab（session active，已在某 pane）    → focus 移到那個 pane，不移動 session
```

**理由**：避免同一 session 出現兩個 pane（狀態同步問題）。使用者預期點 tab 就能看到那個 session，不論它在哪。

---

### 7. "Open in Pane" 入口：統一 Modal + 簡化 EmptyPanePicker

**Project / Worktree 資料模型：**

一個 Project 擁有一組 Worktrees（`git worktree list` 的結果）。每個 Worktree 有自己的路徑與 branch，路徑不保證是 project root 的子目錄（`git worktree add` 可指定任意路徑）。Session 的 cwd 指向某個 Worktree 的路徑，session 所屬 project 透過 `listing` 的 key 決定，**不用路徑前綴比對**。

```
Project (repo root)
  └── Worktree main    path: /projects/app         branch: main
  └── Worktree feat-x  path: /projects/app-feat    branch: feat-x
  └── Worktree hotfix  path: /tmp/hotfix            branch: hotfix
```

**核心決定：將所有「開新 session 或 tool pane」的入口統一到同一個 Modal（「Open in Pane」），取代過去的 dropdown picker。**

**入口觸發點：**

| 觸發點 | 行為 |
|---|---|
| Global Bar `[+]` | 開啟 Modal |
| SessionBar `[+]` | 開啟 Modal |
| EmptyPanePicker「+ Open new session...」 | 開啟 Modal（帶 target paneId） |
| 沒有 active project 的任何 new session 動作 | 開啟 Modal（自然引導選 project） |

**「Open in Pane」Modal 結構：**

```
┌─────────────────────────────────────────────┐
│  Open in pane                        [×]   │
├─────────────────────────────────────────────┤
│  [ Session ]  [ 🌿 Git ]  [ 📁 Files ]  [ 📋 Spec ] │
├─────────────────────────────────────────────┤
│  (Session tab)                              │
│                                             │
│  Existing sessions                          │
│  ──────────────────────────────             │
│  ● ⎇main · Task A   ←在 Left pane          │
│  ○ ⎇feat-x · Task B  ←無 pane             │
│                                             │
│  New session in                             │
│  ──────────────────────────────             │
│  ▾ app                                      │
│      ⎇ main          [+ New session]        │
│      ⎇ feat-x        [+ New session]        │
│      [+ New worktree]                       │
│  ▾ other-repo                               │
│      ⎇ main          [+ New session]        │
│      [+ New worktree]                       │
│                                             │
│  [+ Add project]                            │
└─────────────────────────────────────────────┘
```

Tool tab（Git / Files / Spec）選定後，需再選 cwd（worktree）；預設填入 active project 的 active worktree，可手動切換：

```
┌─────────────────────────────────────────────┐
│  Open in pane                        [×]   │
├─────────────────────────────────────────────┤
│  [ Session ]  [ 🌿 Git ]  [ 📁 Files ]  [ 📋 Spec ] │
├─────────────────────────────────────────────┤
│  (Git tab)                                  │
│                                             │
│  cwd:  ⎇ main (app)  ▾   ← 預填，可換      │
│                                             │
│                      [Open Git pane]        │
└─────────────────────────────────────────────┘
```

**EmptyPanePicker（空白 pane 的 inline 快捷）保留但簡化：**

```
空白 pane inline picker（不彈 modal）：
  Sessions:
    ● ⎇main · Task A
    ○ ⎇feat-x · Task B
  ─────────────────────────────
  [🌿 Git]  [📁 Files]  [📋 Spec]  [🌲 Worktrees]
  ─────────────────────────────
  [+ Open new session...]   ← 點擊 → 開 Modal（帶 target paneId）
```

移除舊的「+ New session」按鈕與「New session in...」grouped list，改由 Modal 統一承接。Inline picker 保留「選現有 session」和「選 tool（不需要 project 上下文）」兩個快速動作。

**理由：**
- Dropdown picker 空間不足以清楚呈現 project → worktree 層級，且無法在同一介面展示 session 清單與 tool 選項。
- Modal 有足夠空間，同時能處理「沒有 active project」的引導場景。
- EmptyPanePicker inline 保留「選現有 session」與「選 tool」，這兩類動作不需要 project 上下文，inline 速度更快；「開新 session」才需要完整的 project/worktree 選擇，交給 Modal。
- 所有 new session 入口統一後，cwd 來源明確（使用者在 Modal 裡主動選擇），不再有「沒有 active project 卻建立 cwd=undefined session」的問題。

---

### 8. Tool Pane 的 cwd

Tool pane（git / files / spec）有自己的 cwd，**不跟著 focused pane 走**，由使用者在 pane header 指定：

```
┌─────────────────────────────────┐
│ 🌿 Git  ⎇main ▾      [⊟][⊞][×] │  ← 點 ⎇main ▾ 切換 worktree
├─────────────────────────────────┤
│  M src/foo.ts                   │
│  M src/bar.ts                   │
└─────────────────────────────────┘
```

**開啟時預設 cwd**：focused pane 的 session cwd（若 focused pane 為 session）；否則 active project cwd。

**理由**：tool pane 固定跟 focused pane 走，在多 pane 情境下反而會造成困惑（切換 focus 就改變 git diff）。使用者明確指定 cwd 更可預期。

---

### 9. Tab Bar 溢位

Tab 數量超過 Tab Bar 寬度時，右側顯示 `»N` overflow 按鈕，點擊展開選單列出剩餘 session。選單內每個 session 點擊行為與直接點 tab 相同（填入 focused pane 或 focus 既有 pane）。

```
[●A ×][●B ×][○C ×][○D ×]  »3  [+]
                             ↑
                   點開後列出 E、F、G session
```

---

### 10. Resize 機制

拖曳分隔線 → 更新 `ratio`，其餘 tree 結構不變。使用 `onPointerMove` + `onPointerCapture`，避免 drag 時選取文字。

---

### 11. Pane Zoom

**決定**：`⌘⇧Z` 將 focused pane 放大至全畫面，等同 tmux `Ctrl+B z`。再按一次還原。

Pane header 顯示 zoom 指示，提醒使用者目前處於 zoomed 狀態：
```
⎇main·Task A  [⊠ zoomed]                [⊟][⊞][×]
```

**實作**：`TabContext` 加入 `zoomedPaneId: string | null`。zoom 時只改這個值，pane tree 結構不動；render 時非 zoomed pane `display: none`。取消 zoom 恢復原本排列。

---

### 12. Pane 對調、拖拉重排與跨 Tab Session 移動

#### Pane 對調（Swap）
**決定**：同一個 split node 的兩個子 pane 可互換位置，等同 tmux `swap-pane`。

操作方式：
- 鍵盤：`⌘⇧方向鍵` 將 focused pane 與相鄰 pane 對調
- Pane header 右鍵選單 →「Swap with →」（桌面）

```
Before:  [ A ║ B ]   →   After:  [ B ║ A ]
swap-right on A
```

**實作**：在 pane tree 中找到包含兩個目標 pane 的最近 split node，交換 `first`/`second`，ratio 不變。

---

#### Pane 拖拉重排（Move Pane）
**決定**：拖曳 pane header 到其他 pane 的邊緣（上/下/左/右 drop zone），可重新排列 pane 結構，等同 tmux `move-pane`。

```
拖 A header 到 C 的右邊：

Before:            After:
[ A ║ B ]         [ B ║ A ║ C ]（C 原本單 pane）
[ ──── ]
[    C  ]
```

Drop zone 視覺：拖曳中 hover 到目標 pane 時，顯示方向指示（上/下/左/右 highlight 區塊）。

操作方式：
- 拖曳 pane header → 顯示 drop zone → 放開 → 重組 pane tree
- 鍵盤：`⌘⇧方向鍵` 也涵蓋此操作（對調或移動，視相鄰狀況決定）

**實作**：
1. 從 pane tree 移除 A（若 A 的 parent 只剩一個 sibling，parent 被 sibling 取代）
2. 在 drop target pane 位置插入新 split node，A 與 target 成為兩個子節點

---

#### 跨 Tab 移動 Session
**決定**：session 本身可跨 tab 移動，透過空白 pane picker 選取（含「目前在哪個 tab」資訊）。

操作方式：
- 在 Tab B 的空白 pane → picker 選 session → 填入，原 pane 變空白
- Pane header 點擊 session 名稱 → dropdown 切換（可選其他 tab 的 session）

---

### 12. Tab

每個 Tab 是獨立工作場景（類似 tmux window），有自己的 pane tree。切換 Tab 切換整個 pane 排列。

```
[ Layout 1 ●]  [ Layout 2 ]  [ Layout 3 ]  [+]  [⊞]
                                                  ↑
                                        Session Manager
```

- `[+]`：新增空白 tab
- Layout 標題可雙擊 rename
- `[×]` 關閉 tab（session 移至其他 tab 或變 inactive）

---

### 13. Mobile 退化策略

`isDesktop === false` 時：
- `SplitPane` 不渲染 split 按鈕（`[⊟][⊞]`）
- Pane tree 強制保持單 leaf（split 操作 disabled）
- Tool pane 仍可在單 pane 內開啟，但不能與 session pane 並排
- Global Bar 維持不動

---

## UI 設計

### 整體佈局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  A. Global Bar（36px）                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  B. Tab Bar（32px）                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  C. Session Tab Bar（40px）                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  D. Split Pane Area（flex-1，session + tool pane 任意組合）                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### A. Global Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  cc-office ▾                                              [+]  [🔍]  [⚙]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 元素 | 功能 |
|---|---|
| `cc-office ▾` | 目前 project 名稱，點擊展開 project switcher dropdown |
| `[+]` | 快速開新 session（展開 worktree quick picker） |
| `[🔍]` | Command palette（`⌘K`） |
| `[⚙]` | Settings |

**Project Switcher Dropdown：**
```
┌──────────────────────┐
│  ✓ cc-office         │
│    other-repo        │
│  ────────────────    │
│  [+ Add project]     │
└──────────────────────┘
```

**Global Bar `[+]` Quick Picker：**
```
┌──────────────────────────┐
│  New session in...       │
│  ● main      (current)   │
│  ○ feat-X                │
│  ○ feat-Y                │
│  ── or ──                │
│  [+ New worktree]        │
└──────────────────────────┘
```

---

### B. Tab Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Layout 1 ●]  [ Layout 2 ]  [ Layout 3 ]  [+]                       [⊞]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 元素 | 功能 |
|---|---|
| Tab | 點擊切換 tab（整個 pane 排列切換） |
| `●` | 該 tab 有 busy session |
| `[+]` | 新增空白 tab |
| `[⊞]` | 開啟 Session Manager overlay |

---

### C. Session Tab Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [●⎇main·Task A ×]  [○⎇feat-X·Task B ×]  [○ Task C ×]  »2  [+]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 元素 | 說明 |
|---|---|
| `●` / `○` | session 狀態（busy / idle） |
| `⎇ main` | session 的 branch |
| `Task A` | session title |
| `×` on tab | 關閉 session（session 結束，pane 變空白） |
| `»N` | overflow，點開列出剩餘 session |
| `[+]` | 在 focused pane 的 cwd 新增 session |

---

### D. Split Pane Area

**單 session pane：**
```
┌──────────────────────────────────────────────┐
│  ⎇ main · Task A                  [⊟] [⊞] [×]│
├──────────────────────────────────────────────┤
│                                              │
│                  Chat A                      │
│                                              │
└──────────────────────────────────────────────┘
```

**session + git tool pane 左右並排：**
```
┌──────────────────────┬───────────────────────┐
│ ⎇main·A   [⊟][⊞][×] ║ 🌿 Git ⎇main▾ [⊟][⊞][×]│
├──────────────────────╫───────────────────────┤
│                      ║  M src/foo.ts         │
│   Chat A             ║  M src/bar.ts         │
│   (focused)          ║  ───────────────      │
│                      ║  diff 內容...         │
└──────────────────────╨───────────────────────┘
                       ↑ 拖曳調整比例
```

**多 session + tool pane 組合：**
```
┌──────────────────────┬───────────────────────┐
│ ⎇main·A   [⊟][⊞][×] ║ ⎇feat·B   [⊟][⊞][×]  │
├──────────────────────╫───────────────────────┤
│                      ║                       │
│   Chat A             ║   Chat B              │
│   (focused)          ╠───────────────────────┤
│                      ║ 📁 Files ⎇feat▾[⊟][⊞][×]│
│                      ╫───────────────────────┤
│                      ║   file tree...        │
└──────────────────────╨───────────────────────┘
```

**空白 pane picker（一站式）：**
```
┌──────────────────────────────────┐
│                       [⊟][⊞][×] │
├──────────────────────────────────┤
│                                  │
│  Sessions:                       │
│  ● ⎇main · Task A  (Layout 1 左) │
│  ○ ⎇feat-X · Task C (無 pane)    │
│                                  │
│  ── Tools ──                     │
│  [🌿 Git]  [📁 Files]  [📋 Spec] │
│  [🌲 Worktrees]                  │
│                                  │
│  ── New session in ──            │
│  [+ main]  [+ feat-X]  [+ feat-Y]│
│                                  │
└──────────────────────────────────┘
```

**Worktrees pane：**
```
┌──────────────────────────────────┐
│ 🌲 Worktrees          [⊟][⊞][×] │
├──────────────────────────────────┤
│  ● main    ↑2  M3  [+] [⋯]      │
│  ○ feat-X       M1  [+] [⋯]     │
│  ○ feat-Y           [+] [⋯]     │
│                                  │
│  [+ New worktree]                │
└──────────────────────────────────┘
```

**Pane Header — session：**
```
⎇ branch · session title                  [⊟] [⊞] [×]
```

**Pane Header — tool：**
```
🌿 Git  ⎇main ▾                           [⊟] [⊞] [×]
        ↑
   點擊切換 worktree cwd
```

---

### E. Context Panel（Session Pane 內建 Tool Panel）

每個 session pane 的 header 提供 `[📁][🌿][📋]` toolbar，點擊展開附著在該 pane 右側的 context panel，cwd 自動跟該 session，不需手動指定。

**展開狀態：**
```
┌──────────────────────────────────────────────────────────┐
│ ⎇main·Task A   [📁][🌿][📋]              [⊟][⊞][×]     │
├────────────────────────────┬─────────────────────────────┤
│                            │ [📁Files] [🌿Git] [📋Spec]  │
│   Chat A                   ├─────────────────────────────┤
│   (focused)                │                             │
│                            │   （tab 內容）               │
│                            │                             │
└────────────────────────────┴─────────────────────────────┘
```

**收合狀態：**
```
┌──────────────────────────────────────────────────────────┐
│ ⎇main·Task A   [📁][🌿][📋]              [⊟][⊞][×]     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Chat A（全寬）                                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**與 Tool Pane（進 split）的差異：**

| | Context Panel | Tool Pane（split）|
|---|---|---|
| 觸發方式 | session header toolbar | 空白 pane picker |
| cwd | 自動跟 session | 手動指定 |
| 同時開多個 | ✗（同 session 只能一個）| ✓ |
| 空間佔用 | 附著在 session pane 內 | 獨立 pane |
| 適合 | 快速查看，不想切 pane | 長時間參考，需要固定位置 |

兩者互補，不互斥。

---

### F. Session Manager Overlay

透過 `⌘⇧M` 或 Tab Bar 右側的 `[⊞]` 按鈕觸發，以 overlay 形式呈現所有 tab 與 session 的總覽。

```
┌─────────────────────────────────────────────────────────────┐
│  Sessions                                          [×]      │
├─────────────────────────────────────────────────────────────┤
│  Layout 1  ────────────────────────────────────────────     │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ ● ⎇main · Task A    │  │ ● ⎇feat · Task B    │          │
│  │ ─────────────────── │  │ ─────────────────── │          │
│  │ Claude: 好的，我已   │  │ Claude: 正在分析...  │          │
│  │ 經完成了第三步，接   │  │ ██████░░░░ running  │          │
│  │ 下來...             │  │                     │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  Layout 2  ────────────────────────────────────────────     │
│                                                             │
│  ┌─────────────────────┐                                    │
│  │ ○ ⎇feat-X · Task C  │                                    │
│  │ ─────────────────── │                                    │
│  │ Claude: 測試全部通   │                                    │
│  │ 過，共 42 個...      │                                    │
│  └─────────────────────┘                                    │
│                                                             │
│  No Tab  ───────────────────────────────────────────     │
│                                                             │
│  ┌─────────────────────┐                                    │
│  │ ○ ⎇main · Task D    │                                    │
│  │ ─────────────────── │                                    │
│  │ You: 幫我重構這段    │                                    │
│  │ code                │                                    │
│  └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

**Session Card 內容：**

| 元素 | 說明 |
|---|---|
| `● / ○` | session 狀態（busy / idle） |
| `⎇ branch · title` | branch 與 session 標題 |
| 最新訊息預覽 | 最後一條訊息（Claude 或 You），截斷於 2–3 行 |
| running indicator | busy 狀態時顯示進度條動畫 |

**Session Card 操作：**
- **點擊** → 關閉 overlay，session 填入目前 focused pane
- **拖曳** → 拖到另一個 Tab 區塊，將 session 移至該 layout
- **`×`** → 關閉 session

**Layout 區塊操作：**
- Layout 標題可點擊 rename（inline edit）
- Tab 區塊右側有 `[×]` 關閉整個 layout（session 移至 No Tab 區）

---

### Viewport 狀態

**Desktop 全開：**
```
┌──────────────────────────────────────────────────────────────────────┐
│ cc-office ▾                                          [+] [🔍] [⚙]   │
├──────────────────────────────────────────────────────────────────────┤
│ [ Layout 1 ●]  [ Layout 2 ]  [+]                               [⊞]  │
├──────────────────────────────────────────────────────────────────────┤
│ [●A×][○B×][○C×]  »2  [+]                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              Split Pane Area（全寬）                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Mobile（< 768px）：**
```
┌──────────────────────────┐
│ cc-office ▾    [+] [⚙]  │
├──────────────────────────┤
│ [ L1 ●] [ L2 ]  [+] [⊞] │
├──────────────────────────┤
│ [●A×][○B×]  [+]          │
├──────────────────────────┤
│                          │
│  Chat A（強制單 pane）   │
│                          │
└──────────────────────────┘
[⊟][⊞] 隱藏，不可切割
```

---

### 完整 Keyboard Shortcuts

| 快捷鍵 | 功能 |
|---|---|
| `⌘T` | 在 focused pane 的 cwd 開新 session |
| `⌘W` | 關閉 focused pane |
| `⌘\` | 左右切 focused pane |
| `⌘-` | 上下切 focused pane |
| `⌘⌥ ←/→/↑/↓` | 移動 focus 到相鄰 pane |
| `⌘⇧Z` | Zoom focused pane / 取消 zoom |
| `⌘⇧ ←/→/↑/↓` | 將 focused pane 與相鄰 pane 對調 / 移動 |
| `⌘⇧M` | 開啟 Session Manager overlay |
| `⌘K` | Command palette |

---

## Risks / Trade-offs

- **[風險] TabContext 變大** → pane tree + focusedPaneId 加入後 context 職責變複雜。Mitigation：拆出 `usePaneActions` / `usePaneState` selector，避免所有 consumer re-render。
- **[風險] forceMount 數量增加** → 多個 session 同時 mounted，記憶體佔用上升。Mitigation：監控 `browser-memory-leak` change，必要時對非 focused pane 的 session 加 virtualization。
- **[風險] WorkspaceTopbar / Sidebar / Right Pane 廢除影響現有測試** → 相關 test 需全部重寫。Mitigation：先建新元件 + 測試，再廢除舊元件。
- **[Trade-off] 沒有固定側欄** → 使用者需要手動開 tool pane，比固定 Right Pane 多一步。可接受：節省固定空間（原本 Right Pane 360px + Sidebar 260px）在多 pane 情境下更有價值。
- **[Trade-off] Pane layout 不持久化** → 重整頁面 layout 消失，但 session 保留在 tab bar。可接受：layout 是臨時工作狀態，session 才是資料。
- **[Trade-off] 同一 session 不能出現在兩個 pane** → 無法「mirror」session 內容。已知限制，v1 不實作。

## Migration Plan

1. 新建 `GlobalBar`（含 project switcher、`[+]` quick picker、search、settings）
2. 新建 `TabBar`（tab 切換、`[+]`、Session Manager 按鈕）
3. 新建 `SplitPaneRoot` + `SplitPane` + `PaneHeader`（支援 session / git / files / spec / worktrees 內容類型）
4. `TabContext` 加入 `paneRoot` + `focusedPaneId` + 操作 actions，PaneContent 型別擴充
5. `TabContainer` 換成 `SplitPaneRoot`，移除舊的 `Tabs.Root` 單 content render
6. 實作 split 行為（`[⊟]` / `[⊞]` 按鈕）
7. 實作 resize（分隔線拖曳）
8. 實作 pane swap / move（鍵盤 + 拖曳）
9. 實作空白 pane picker（session + tool + new session 一站式）
10. 新建各 tool pane 元件（`GitPane` / `FilesPane` / `SpecPane` / `WorktreesPane`）
11. 調整 Session Tab Bar 點擊行為（填入 focused pane）
12. 實作 Session Manager overlay
13. `WorkspaceLayout` 換成 `GlobalBar` + `LayoutTabBar`，移除 `WorkspaceTopbar` / `Sidebar` / `Right Pane`
14. 更新所有相關測試

## Open Questions

- Project switcher 切換時，現有 split layout 是否保留？（目前傾向：保留，session 不動，只改 `[+]` 的預設 cwd）
- Session history 入口放在哪？（候選：Global Bar、Session Manager overlay 內、`⌘⇧H`）
