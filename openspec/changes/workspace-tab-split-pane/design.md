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
- Layout 持久化：每個 Layout Tab 的 pane tree + cwd 透過 WebSocket 存在 server，跨裝置同步（見 Decision 14）
- Session 永遠在 pane：layout 持久化後 session 不存在「無 pane」狀態，Session Tab Bar 因此移除（見 Decision 14）
- Focus Model：click pane → focus
- New Session：空白 pane picker 是主要開 session 入口；Layout Tab `[+]` 開新空白 layout
- Tab：每個 tab 是獨立工作場景（類似 tmux window），有自己的 pane 排列，持久化在 server
- Context Panel：`ChatBreadcrumb` toggle 快速展開 Files / Git / Spec inline side panel，cwd 自動跟 session
- Workspace Overview：overlay 總覽所有 tab / session + project/worktree 管理，含最新訊息預覽、拖曳重排
- Mobile 退化：小螢幕強制單 pane，不顯示 split 功能

**Non-Goals:**
- Global Bar（已移除，project switcher / active project 概念不需要）
- 固定左側 Sidebar 或固定右側 Right Pane（改為 tool pane 進入 split area）
- 同一個 session 出現在多個 pane（不允許，點 tab 只 focus 既有 pane）
- Session Tab Bar（已由 layout 持久化取代，見 Decision 14）
- 跨 Tab 的 pane 整體搬移（session 可跨 tab，但 pane 結構不跨）

## 名詞定義

本文件統一使用以下術語（對齊 tmux 概念，但以 Tab + Pane 命名避開 browser `window` 全域變數衝突）：

| 術語 | 對應 tmux | 說明 |
|---|---|---|
| **Tab** | Window | WorkspaceTabBar 上的每一格，代表一個獨立工作場景 |
| **PaneNode** | — | Tab 內 pane tree 的節點，union type：`PaneSplit \| PaneLeaf` |
| **PaneSplit** | — | 純 layout 容器，有 first/second 子節點，使用者看不到 |
| **PaneLeaf** | Pane | 使用者看到的格子，有 content |
| **PaneContent** | — | PaneLeaf 的內容類型（session / files / git / openspec） |
| **Channel** | — | Server 端一個跑著的 Claude process，對應 client 的 session |

**Client 資料結構：**

```
TabContext
├── tabs: Tab[]
│     └── Tab
│           ├── id: string
│           ├── label?: string
│           ├── focusedPaneId: string | null
│           ├── zoomedPaneId: string | null
│           └── paneRoot: PaneNode
│                 │
│                 ├── PaneSplit
│                 │     ├── id: string
│                 │     ├── direction: 'h' | 'v'
│                 │     ├── ratio: number (0.0–1.0)
│                 │     ├── first: PaneNode
│                 │     └── second: PaneNode
│                 │
│                 └── PaneLeaf
│                       ├── id: string
│                       └── content: PaneContent
│                             ├── { type: 'session';  sessionId: string | null }
│                             ├── { type: 'files';    cwd: string }
│                             ├── { type: 'git';      cwd: string }
│                             └── { type: 'openspec'; cwd: string }
│
└── activeTabId: string | null
```

- `PaneLeaf.content.type === 'session'`：可綁定一個 Channel（nullable），空白時顯示 EmptyPanePicker
- `PaneLeaf.content.type === 'files/git/openspec'`：綁定 cwd，不需要 Channel
- `focusedPaneId` / `zoomedPaneId`：runtime 狀態，不持久化

---

## Decisions

### 1. Pane Tree 資料結構：Binary Tree，Leaf 支援多種內容類型

```typescript
type PaneContent =
  | { type: 'session';  sessionId: string | null }
  | { type: 'git';      cwd: string }
  | { type: 'files';    cwd: string }
  | { type: 'openspec'; cwd: string }

type PaneLeaf = { type: 'leaf';  id: string; content: PaneContent }
type PaneSplit = { type: 'split'; id: string; direction: 'h' | 'v'; ratio: number;
                   first: PaneNode; second: PaneNode }
type PaneNode = PaneLeaf | PaneSplit

interface Tab {
  id: string
  label?: string
  paneRoot: PaneNode
  focusedPaneId: string | null   // runtime，不持久化
  zoomedPaneId: string | null    // runtime，不持久化
}
```

**理由**：tmux 相同模型，能表達任意切割方向與深度。tool pane 與 session pane 共用同一個 pane tree，不需要額外的固定側欄。ratio（0.0–1.0）控制兩側比例，resize 只改 ratio 不動結構。

**替代方案捨棄**：固定 Right Pane 側欄 —— 無法同時查看兩個 worktree 的 git diff，且在多 pane 情境下「跟著 focused pane」語義模糊；固定 Sidebar —— 佔用固定空間，worktree 管理「需要時才開」更符合使用習慣。

---

### 2. Pane Tree State 放在 TabContext

**決定**：`tabs: Tab[]`、`activeTabId` 作為 `TabContext` 的核心狀態。每個 `Tab` 內含完整 pane tree（`paneRoot`）與 runtime state（`focusedPaneId`、`zoomedPaneId`）。

**理由**：pane tree 與 tab 高度耦合，切換 tab 就是切換整個 pane tree；合併在同一個 context 讓操作自然，不需要跨 context 協調。

**替代方案捨棄**：新建 `SplitPaneContext`——需要在 `TabContainer` 以上 provide，且幾乎所有 pane 操作都需要同時讀 tab 狀態，合併更自然。

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
| Tab Bar | ✗ | 所有 session，跨 project / worktree |
| Split Pane | ✗ | 任意 session / tool pane 可並排，跨 project / worktree |
| Tool Pane | 自訂 | 各 tool pane 有自己的 cwd，由使用者在 pane header 切換 |

**理由**：使用者用 tmux 管理多個工作 context 的習慣，反映在 UI 上就是 Tab Bar 和 Split Pane 不設 project 邊界。無 Global Bar 後，不存在「active project」概念；所有 project / worktree 的選擇都發生在開 session 的當下。

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

### 7. PanePicker 入口：Session Tab Bar `[+]` + EmptyPanePicker

**Project / Worktree 資料模型：**

一個 Project 擁有一組 Worktrees（`git worktree list` 的結果）。每個 Worktree 有自己的路徑與 branch，路徑不保證是 project root 的子目錄（`git worktree add` 可指定任意路徑）。Session 的 cwd 指向某個 Worktree 的路徑，session 所屬 project 透過 `listing` 的 key 決定，**不用路徑前綴比對**。

```
Project (repo root)
  └── Worktree main    path: /projects/app         branch: main
  └── Worktree feat-x  path: /projects/app-feat    branch: feat-x
  └── Worktree hotfix  path: /tmp/hotfix            branch: hotfix
```

**核心決定：移除 Global Bar，無 active project 概念。所有「開新 session」的入口在 Session Tab Bar `[+]` 和 EmptyPanePicker；「開 tool pane」在 EmptyPanePicker inline。**

**入口觸發點：**

| 觸發點 | 行為 |
|---|---|
| Session Tab Bar `[+]` | 彈出 "New Session" dropdown（列出所有 project 的 worktrees，inline 快速選） |
| EmptyPanePicker worktree 按鈕 | 直接在該 pane 建立 session（不需 modal） |
| EmptyPanePicker tool 按鈕 | 直接在該 pane 開 tool pane（不需 modal） |
| EmptyPanePicker「More options...」 | 開啟完整 Modal（跨 project、選 tool worktree 等複雜場景） |

**Session Tab Bar `[+]` dropdown（快速開 session）：**

```
┌──────────────────────────────────────┐
│  New session in...                   │
│                                      │
│  app                                 │
│  ─────────────────────────────────   │
│  ⎇ main                        [+]   │
│  ⎇ feat-x                      [+]   │
│  [+ New worktree]                    │
│                                      │
│  other-repo                          │
│  ─────────────────────────────────   │
│  ⎇ main                        [+]   │
│  [+ New worktree]                    │
│                                      │
│  [+ Add project]                     │
└──────────────────────────────────────┘
```

點 `[+]` 旁的 worktree → 直接在 focused pane 建立 session，dropdown 關閉。

**EmptyPanePicker（空白 pane 的 inline 一站式）：**

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
│  app: [+ main]  [+ feat-X]       │
│  other: [+ main]                 │
│                                  │
│  [More options...]               │
└──────────────────────────────────┘
```

- Sessions：點擊 → 填入該 pane
- Tool 按鈕（Git/Files/Spec）：直接以 focused session cwd 開 tool pane（不需 modal）
- `[+ branch]`：直接在該 pane 建立 session
- `[More options...]`：開啟完整 "PanePicker（需要跨 project 或指定 tool pane 的 worktree 時）

**PanePicker — 設計方案 B（主選，單欄平面列表 + view 切換）：**

單欄 modal，每個 worktree 展開顯示 active sessions 與一列 tool pane 按鈕。
需要再選一步的 action 以 `▶` 標示，點擊後 PanePicker **整體切換 view**（mini-router），返回用 `[←]`。

```
┌────────────────────────────────────────────────┐
│  Open in pane                            [×]  │
├────────────────────────────────────────────────┤
│  app                                           │
│  ⎇ main  ●                                     │
│    ○ Task A  ←Left pane          [Show here]  │
│    [💬 AI ▶] [🌿 Git] [📁 Files] [📋 Spec]    │
│  ⎇ feat-x                                      │
│    [💬 AI ▶] [🌿 Git] [📁 Files] [📋 Spec]    │
│    [+ New worktree]                            │
│  [+ Add project]                               │
└────────────────────────────────────────────────┘
```

Resume / Import 不在主 view 出現，統一收在 `[💬 AI ▶]` 下，與 AI 種類綁定。

#### Tool pane 按鈕分兩類

| 類型 | 按鈕 | 行為 |
|---|---|---|
| **One-click** | `🌿 Git` `📁 Files` `📋 Spec` | 直接開 pane |
| **View-switch** | `💬 AI ▶` | PanePicker 切換到 AI picker view |

#### View 切換層級（mini-router）

完整三層架構，但當只有一個 AI provider 時自動折疊為兩層（跳過選 provider）：

```
主 view（worktree 列表）
│
└─ [💬 AI ▶] → AI picker view
     │
     │  ── 單一 AI provider（目前只有 Claude）──
     │  直接顯示 actions，不需選 provider（2 clicks）
     ├─ [+ New Session]  → 立刻開 session
     ├─ [⟳ Resume ▶]    → session 清單（3 clicks）
     └─ [⬆ Import ▶]    → format picker（3 clicks）
     │
     │  ── 多個 AI provider（未來 Claude + Codex）──
     │  先選 provider，再進 actions（3 clicks）
     ├─ [Claude ▶] → Claude view
     │    ├─ [+ New Session]
     │    ├─ [⟳ Resume ▶]  → Claude session 清單（4 clicks）
     │    └─ [⬆ Import ▶]  → Claude format picker
     └─ [Codex ▶] → Codex view
          ├─ [+ New Session]
          ├─ [⟳ Resume ▶]  → Codex session 清單
          └─ [⬆ Import ▶]  → Codex format picker
```

**理由：**
- 統一三層概念（AI → provider → action），Resume / Import 與 AI 種類綁定。
- 單一 provider 時自動折疊，避免無意義的一個選項 picker，最常用路徑維持 2 clicks。
- 加新 AI 只改 AI picker view，不動主 view 結構。
- View 切換而非 sub-modal：Esc 永遠關整個 PanePicker，`[←]` 返回上一層，無 dismiss 歧義。
- Git / Files / Spec 永遠 one-click，常用路徑不增加步驟。

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

**開啟時預設 cwd**：focused pane 的 session cwd（若 focused pane 為 session）；否則第一個已知 project 的第一個 worktree。

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
                                       Workspace Overview
```

- `[+]`：新增空白 tab
- Layout 標題可雙擊 rename
- `[×]` 關閉 tab（session 內的 pane 一併關閉）

---

### 13. Mobile 退化策略

`isDesktop === false` 時：
- `SplitPane` 不渲染 split 按鈕（`[⊟][⊞]`）
- Pane tree 強制保持單 leaf（split 操作 disabled）
- Tool pane 仍可在單 pane 內開啟，但不能與 session pane 並排
- Tab Bar 維持不動（含 `[⊞]` Workspace Overview 入口）

---

### 14. Layout 持久化 + Session Tab Bar 移除

**決定**：Layout（pane tree + 各 leaf 的 cwd）透過 WebSocket 持久化在 server，跨裝置即時同步。Session Tab Bar 因此移除。

**理由**：
- 使用者切換裝置或重新整理，workspace 完全恢復，不需手動重建
- WebSocket 已是 cc-office 的通訊基礎，server-side persistence 是自然延伸
- Layout 持久化後，session 永遠活在某個 pane 裡，「有 session 但無 pane」的狀態不存在
- Session Tab Bar 存在的唯一理由是管理 inactive（無 pane）的 session；這個狀態消失後 Session Tab Bar 隨之移除
- 去掉一整條 bar 讓 Split Pane Area 有更多垂直空間

**持久化的 schema（`PersistedLayout`）**：

```ts
// sessionId 是 runtime 概念，不持久化；PaneLeaf session 改存 cwd
type PersistedPaneContent =
  | { type: 'session';  cwd: string | null }
  | { type: 'files';    cwd: string }
  | { type: 'git';      cwd: string }
  | { type: 'openspec'; cwd: string }

type PersistedPaneLeaf  = { type: 'leaf';  id: string; content: PersistedPaneContent }
type PersistedPaneSplit = { type: 'split'; id: string; direction: 'h' | 'v'; ratio: number;
                            first: PersistedPaneNode; second: PersistedPaneNode }
type PersistedPaneNode  = PersistedPaneLeaf | PersistedPaneSplit

type PersistedTab = { id: string; label?: string; paneRoot: PersistedPaneNode }
// focusedPaneId / zoomedPaneId 不持久化

type PersistedLayout = { tabs: PersistedTab[]; activeTabId: string }
```

**不持久化的欄位**：`sessionId`（runtime）、`focusedPaneId`（預設 first leaf）、`zoomedPaneId`（transient）、`rightOpen`（預設 false）。

**新增的 server events**：

| Event | 方向 | 說明 |
|---|---|---|
| `layout:save` | client → server | debounce 儲存當下 layout（每次 TabContext 狀態改變） |
| `layout:load` | client → server | 連線初始化時請求上次儲存的 layout |
| `layout:loaded` | server → client | 回傳 `PersistedLayout`（或 null，表示無 layout） |
| `layout:sync` | server → client | 有其他 browser 更新 layout 時，廣播給其他連線（排除發送者） |

**同步策略：last-write-wins**

```
Browser A  →  layout:save(json)
              ↓
            Server 存 memory（覆蓋）
              ↓
            socket.broadcast.emit("layout:sync", json)  ← 排除 A 自己
              ↓
Browser B  ←  layout:sync(json)  →  rehydrate TabContext
Browser C  ←  layout:sync(json)  →  rehydrate TabContext
```

兩個 browser 同時操作時，後寫入者獲勝（last-write-wins），不做 conflict resolution。Server 重啟後 layout 清空，browser 重連收到 `null` 從預設狀態開始。

**Server 實作（輕量，memory only，無 DB）**：

```ts
class LayoutStore {
  private layout: unknown = null

  save(layout: unknown): void {
    this.layout = layout
  }

  load(): unknown | null {
    return this.layout
  }
}
```

**Client 行為**：

| 時機 | 行為 |
|---|---|
| Tab 狀態變動（split / close / resize / label） | debounce `layout:save(PersistedLayout)` |
| 連線初始化 | `layout:load` → 收到 `layout:loaded` → rehydrate TabContext |
| 收到 `layout:sync` | rehydrate TabContext（來自其他 browser） |
| rehydrate 後 | `focusedPaneId = firstLeafId(paneRoot)`，`zoomedPaneId = null`，`sessionId = null` |

**Server 行為**：

| 收到事件 | 處理 |
|---|---|
| `layout:save(payload)` | `layoutStore.save(payload)` → `socket.broadcast.emit("layout:sync", payload)` |
| `layout:load` | `socket.emit("layout:loaded", layoutStore.load())` |

**Session 恢復策略（保守）**：rehydrate 時所有 PaneLeaf session 的 `sessionId = null`（顯示 EmptyPanePicker + cwd 提示），使用者點擊後手動開 session。不自動建立 session，避免重整後同時開多個 session。

**Session Tab Bar 移除後的替代入口**：
- 新 session → EmptyPanePicker 的 `[+ New session]` / `[+ branch]`
- 切換 session → 切換 Tab（每個 Tab 有自己的 pane tree）
- `forceMount` hidden pool 不再需要（session 無 limbo 狀態）

**與 Decision 1–3 的關係**：
- Decision 1（pane tree binary tree）不變，新增序列化/反序列化路徑
- Decision 3（forceMount 策略）**修訂**：移除 hidden pool forceMount，session 只在 pane 內 mount
- Session Tab Bar（B 區）整條移除，佈局從三條 bar 變兩條

```
移除前：                    移除後：
┌──────────────────────┐   ┌──────────────────────┐
│  A. Layout Tab Bar   │   │  A. Layout Tab Bar   │
├──────────────────────┤   ├──────────────────────┤
│  B. Session Tab Bar  │   │                      │
├──────────────────────┤   │  B. Split Pane Area  │
│  C. Split Pane Area  │   │     （更多空間）       │
└──────────────────────┘   └──────────────────────┘
```

---

## UI 設計

### 整體佈局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  A. Tab Bar（32px）                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  B. Session Tab Bar（40px）                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  C. Split Pane Area（flex-1，session + tool pane 任意組合）                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Global Bar 已移除。Settings `[⚙]` 移至 Tab Bar 右側；Search 純鍵盤（`⌘K`）。

---

### A. Tab Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Layout 1 ●]  [ Layout 2 ]  [ Layout 3 ]  [+]              [⊞]  [⚙]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 元素 | 功能 |
|---|---|
| Tab | 點擊切換 tab（整個 pane 排列切換） |
| `●` | 該 tab 有 busy session |
| `[+]` | 新增空白 tab |
| `[⊞]` | 開啟 Session Manager overlay |
| `[⚙]` | Settings（原 Global Bar，移至此） |

---

### B. Session Tab Bar

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
| `[+]` | 展開 "New session in..." dropdown，列出所有 project 的 worktrees |

---

### C. Split Pane Area

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

每個 session pane 的 `ChatBreadcrumb` 提供一個 `[⊞]` toggle icon，點擊展開附著在該 pane **右側的 inline side panel**（`RightPane`），cwd 自動跟該 session，不需手動指定。呈現方式與 main branch 完全一致：panel inline 嵌入於 pane 內部（`flex-row`），不使用 overlay。

**Toggle icon 位置：`ChatBreadcrumb`（與 main branch 一致）**

`PaneHeader` 負責 pane 層級控制（split、close、branch/title 顯示），**不負責** RightPane 開關。
toggle icon 放在 `ChatBreadcrumb` 是因為：
- RightPane 是 chat session 的 context view，語義上屬於 chat，不屬於 pane
- 只有 `node.content.type === 'session'` 時才有意義（git/files/spec tool pane 無 RightPane）
- 與 main branch 保持一致，降低分歧

**展開狀態（inline side panel）：**
```
┌──────────────────────────────────────────────────────────┐
│ ⎇main · Task A                            [⊞] [⊟][⊞][×] │  ← [⊞] = ChatBreadcrumb toggle
├────────────────────────────┬─────────────────────────────┤
│                            │ [📁Files] [🌿Git] [📋Spec]  │
│   Chat A                   ├─────────────────────────────┤
│   (focused)                │                             │
│                            │   （tab 內容，w-72）         │
│                            │                             │
└────────────────────────────┴─────────────────────────────┘
```

**收合狀態：**
```
┌──────────────────────────────────────────────────────────┐
│ ⎇main · Task A                            [⊞] [⊟][⊞][×] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Chat A（全寬）                                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**State 位置：`rightOpen: boolean` 在 `PaneLeafContent`**

`PaneHeader` 不再有 `activeTool`、`onToolSelect` props，不渲染 tool icon。
`PaneLeafContent` 持有 `rightOpen: boolean`，透過 `onToggleRight` callback 傳給 `ChatView`：

```
PaneLeafContent
  rightOpen: boolean
  ├─ PaneHeader（無 tool icon，只有 branch/title + split/close）
  └─ TabContent → ChatView → ChatBreadcrumb
                    onToggleRight={() => setRightOpen(v => !v)}
                    rightPane={rightOpen ? <RightPane cwd={cwd} /> : null}
                                             └─ Radix Tabs（files / git / spec）
```

**RightPane 的 tab 內容使用 main branch 的完整實作：**

| Tab | 元件 | 來源 |
|---|---|---|
| Files | `FilesPane` | `apps/web/src/components/files/FilesPane.tsx` |
| Git | `GitPane` | `apps/web/src/components/git/GitPane.tsx` |
| Spec | `SpecPane` | `apps/web/src/components/spec/SpecPane.tsx` |

`FilesPane`、`GitPane`、`SpecPane` 是完整功能實作（git diff、commit、file preview、spec CRUD），
`ContextPanel.tsx` 中的輕量版（`ContextPanelGit/Files/Spec`）已廢棄。

**`RightPane` 與 Tool Pane 共用同一套元件：**

```
RightPane（Context Panel inline side panel）
  ├─ Files tab → <FilesPane cwd={cwd} />
  ├─ Git tab   → <GitPane cwd={cwd} />
  └─ Spec tab  → <SpecPane cwd={cwd} />

ToolPanes（split pane 獨立型）
  ├─ FilesPane（直接渲染，pane header 可切換 worktree）
  ├─ GitPane
  └─ SpecPane
```

兩個進入點共用同一個元件實作，沒有重複邏輯。

**RightPane 的 `onMention` 處理：**

`FilesPane` 需要 `onMention(path)` callback。在 `RightPane` context 中，
`onMention` 應把 `@path` 插入當前 session 的 compose 欄，透過 `useChannelComposeActions` 實現。

**與 Tool Pane（進 split）的差異：**

| | Context Panel（RightPane） | Tool Pane（split）|
|---|---|---|
| 觸發方式 | session header toolbar icon | 空白 pane picker |
| cwd | 自動跟 session，不可改 | 手動指定，可在 pane header 切換 |
| 同時開多個 | ✗（同 session 只能一個） | ✓ |
| 空間佔用 | inline，附著在 session pane 右側 | 獨立 pane |
| 適合 | 快速查看，不想切 pane | 長時間參考，需要固定位置 |

兩者互補，不互斥。

---

### F. Workspace Overview（原 Session Manager）

透過 `⌘⇧M` 或 Tab Bar 右側的 `[⊞]` 按鈕觸發，以 overlay 形式同時呈現所有 session 狀態與 project/worktree 管理。**取代原本的 Project List UI，成為唯一的 project 管理入口。**

```
┌─────────────────────────────────────────────────────────────┐
│  Workspace                                         [×]      │
├─────────────────────────────────────────────────────────────┤
│  Layout 1  ────────────────────────────────────────────     │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ ● ⎇main · Task A    │  │ ● ⎇feat · Task B    │          │
│  │ ─────────────────── │  │ ─────────────────── │          │
│  │ Claude: 好的，我已   │  │ Claude: 正在分析...  │          │
│  │ 經完成了第三步...    │  │ ██████░░░░ running  │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  Layout 2  ────────────────────────────────────────────     │
│                                                             │
│  ┌─────────────────────┐                                    │
│  │ ○ ⎇feat-X · Task C  │                                    │
│  │ ─────────────────── │                                    │
│  │ Claude: 測試全部通過 │                                    │
│  └─────────────────────┘                                    │
│                                                             │
│  No Tab  ──────────────────────────────────────────────     │
│                                                             │
│  ┌─────────────────────┐                                    │
│  │ ○ ⎇main · Task D    │                                    │
│  │ ─────────────────── │                                    │
│  │ You: 幫我重構這段    │                                    │
│  └─────────────────────┘                                    │
│                                                             │
│  Projects  ─────────────────────────────────────────────   │
│                                                             │
│  cc-office                                     [⋯]         │
│    ⎇ main      Task A（Layout 1）                           │
│    ⎇ feat-x    Task B（Layout 1）                           │
│    ⎇ hotfix    ─              [+ New session]               │
│    [+ New worktree]                                         │
│                                                             │
│  other-repo                                    [⋯]         │
│    ⎇ main      ─              [+ New session]               │
│    [+ New worktree]                                         │
│                                                             │
│  [+ Add project]                                            │
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

**Projects 區塊：**

| 元素 | 說明 |
|---|---|
| project 名稱 + `[⋯]` | 展開選單：Rename、Remove project |
| `⎇ branch  session title` | 有 session 的 worktree，顯示在哪個 layout |
| `⎇ branch  ─  [+ New session]` | 沒有 session 的 worktree，可直接建立 |
| `[+ New worktree]` | 在該 project 建立新 worktree |
| `[+ Add project]` | 加入新 project（原 Global Bar / EmptyState 入口） |

**理由：**
- Project List 與 Session Manager 的資料高度相關（session 對應 worktree 對應 project），合併為同一個 overlay 減少跳轉。
- 移除 Global Bar 後，project 管理需要一個新家；Workspace Overview 是自然的位置。
- 使用者可以在一個畫面看到「哪些 worktree 有 session、哪些沒有」，直接從沒有 session 的 worktree 開新工作。

---

### Viewport 狀態

**Desktop 全開：**
```
┌──────────────────────────────────────────────────────────────────────┐
│ [ Layout 1 ●]  [ Layout 2 ]  [+]                          [⊞]  [⚙]  │
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
| `⌘⇧M` | 開啟 Workspace Overview overlay |
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

1. 新建 `TabBar`（tab 切換、`[+]`、`[⊞]` Workspace Overview 按鈕、`[⚙]` settings）
2. 新建 `SplitPaneRoot` + `SplitPane` + `PaneHeader`（支援 session / git / files / spec / worktrees 內容類型）
3. `TabContext` 加入 `paneRoot` + `focusedPaneId` + 操作 actions，PaneContent 型別擴充
4. `TabContainer` 換成 `SplitPaneRoot`，移除舊的 `Tabs.Root` 單 content render
5. 實作 split 行為（`[⊟]` / `[⊞]` 按鈕）
6. 實作 resize（分隔線拖曳）
7. 實作 pane swap / move（鍵盤 + 拖曳）
8. 實作空白 pane picker（session + tool + new session 一站式，含 `[More options...]`）
9. 新建各 tool pane 元件（`GitPane` / `FilesPane` / `SpecPane` / `WorktreesPane`）並接實際 server RPC
10. Session Tab Bar `[+]` → "New session in..." inline dropdown（列所有 project/worktrees）
11. 調整 Session Tab Bar 點擊行為（填入 focused pane）
12. 實作 Workspace Overview overlay（sessions + projects + worktrees 合一）
13. 移除 `GlobalBar`，移除 `activeProjectCwd` / active project 概念
14. `WorkspaceLayout` 換成 `TabBar` + `SessionTabBar`，移除 `WorkspaceTopbar` / `Sidebar` / `Right Pane`
15. 更新所有相關測試

## Open Questions

- Session history 入口放在哪？（候選：Workspace Overview 內、`⌘⇧H`）
