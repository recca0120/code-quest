# Pane Tree Named Components — Design

## Context

來源：2026-06-10 Pane 設計討論。初版草案經三視角批判審查（React API 人體工學 / serialization 正確性 / 16 情境覆蓋）修正，本文件是修正後的定版。被推翻的草案決策（deserialize-time liveness、merge-by-leaf-id reconcile、單一 PaneKind registry、PaneRenderCtx god context）記在「否決記錄」節，避免重蹈。

Wire schema v2 與同步演算法記在 `layout-persistence` change（design.md「v2 修訂」），本文件負責 client 元件架構。

---

## 元件樹

```
TabContainer（瘦身後：組 context、SessionPool、pendingSession effect）
│
├─ PaneTree                       ← 現 SplitPane 改名：遞迴渲染器，吃 paneRoot
│   ├─ PaneSplit                  ← 現 SplitPaneNode split 分支
│   │    │  direction / ratio ＋ PaneDivider
│   │    │  ⚠ zoom/mobile 可見性與尺寸決策在這裡（見「Zoom 修正」）
│   │    ├─ (first)  PaneSplit | PaneLeaf
│   │    └─ (second) PaneSplit | PaneLeaf
│   └─ PaneLeaf                   ← 現 SplitPaneLeaf：click-to-focus、key={node.id}
│        └─ <Pane>                ← 既有 compound，由 PaneLeaf 統一渲染
│             ├─ <Pane.Toolbar {...common}>   ← split/close/swap 一處保證
│             │     └─ {kind.ToolbarTools}    ← 各 type 自訂 tools slot
│             └─ body（scrollable 時包 Pane.Content）
│                  └─ exhaustive switch →
│                     ├─ SessionPane    （內含 EmptyPane render 分支）
│                     ├─ GitPane        （ToolbarTools = WorktreeSwitcher 🌿）
│                     ├─ FilesPane      （ToolbarTools = WorktreeSwitcher 📁）
│                     ├─ OpenspecPane   （ToolbarTools = WorktreeSwitcher 📋）
│                     └─ WorktreesPane  （自動獲得標準 toolbar）
│
└─ SessionPool                    ← 現 inactive-tab-sessions + session-pool 抽名
     └─ TabContent × N            ← ChannelProvider 掛載單位，pane 與 pool 共用
```

## Decisions

### D1. PaneContent 新 shape

```ts
type PaneContent =
  | { type: 'session'; sessionId: string | null; cwd: string | null }
  | { type: 'git'; target: PaneTarget }
  | { type: 'files'; target: PaneTarget }
  | { type: 'openspec'; target: PaneTarget }      // 'spec' rename
  | { type: 'worktrees' };

type PaneTarget = { kind: 'fixed'; cwd: string } | { kind: 'follow' };  // follow = D5 預留，暫不實作
```

- session 的 cwd 在**綁定當下**寫入：`setSessionInPane(paneId, sessionId, cwd)`、`splitPaneAndAssign(direction, sessionId, cwd)`——serialize 因此是純 tree function，不需要查 tabs map（save effect 的 deps 只有 `[wsState]`，timer fire 時 tabs 是 stale closure，**必然**拿到舊值——這是否決 SerializeCtx 的原因）
- session 死掉時 content 不變（sessionId 仍在），render 層自動降級（見 D3）

### D2. 兩個 registry，依賴方向單向

```ts
// ① contexts/pane-codecs.ts —— 純 TS，零 React import，TabContext 只吃這個
type Serializers = {
  [K in PaneContent['type']]: (
    c: Extract<PaneContent, { type: K }>,
  ) => Extract<PersistedPaneContent, { type: K }>;
};
function serializeContent<K extends PaneContent['type']>(
  c: Extract<PaneContent, { type: K }>,
) { return SERIALIZERS[c.type](c); }   // TS#47109 generic indexed access，零 cast

// ② PaneLeaf 內 —— view dispatch 用 exhaustive switch
switch (content.type) {
  case 'session': return <SessionPane paneId={id} content={content} />;
  // ...
  default: content satisfies never;    // 新 type 漏接 → 編譯錯
}
```

- **不可**做單一 `PANE_KINDS = { Component + serialize }`：TabContext import registry → registry 含 SessionPane → import 回 TabContext 的 runtime 循環；TabProvider 也會失去 standalone 測試能力
- **不可**用 Record lookup 渲染 union component：JSX props 塌縮成 never，必逼出 cast
- 加靜態斷言 `AssertEqual<PaneContent['type'], PersistedPaneContent['type']>` 守住兩個 union 的 key 同步

### D3. Liveness 判斷在 render time，不在 deserialize

- deserialize **無條件**保留 channelId/cwd（純形狀轉換、permissive、**不驗 cwd 有效性、不查 live sessions**）
- `SessionPane` render 時查 `tabs[sessionId]`：meta 存在 → `TabContent`（mode:'resume' 重綁不 spawn）；缺席 → EmptyPane ＋「上次: {project} ⎇ {branch}」hint（branch/project 用 content.cwd 反查 worktree-centric D3 的 lookup map，**不入 wire**——checkout 改名會 stale）
- 自動 self-heal：sessions 晚到 → meta 出現 → 同一 leaf 自動切回 TabContent；`session:dead` → removeTab → 自動降級 EmptyPane（rebind 後才死的 race 同樣收斂）
- `serialize∘deserialize ≡ identity` 是硬性契約（echo guard 的前提），需 property test

### D4. Toolbar 所有權反轉

PaneLeaf 統一渲染 `<Pane>` + `<Pane.Toolbar {...common}>`；pane type 模組只提供：

```ts
interface PaneView {
  ToolbarTools?: React.ComponentType<{ paneId: string; content: ... }>;
  Body: React.ComponentType<{ paneId: string; content: ... }>;
  scrollable?: boolean;   // 預設 true 包 Pane.Content；session 自管捲動設 false
}
```

- common props = `{ paneId, isOnly, onSplitH, onSplitV, onClose, onSwap }`——**onSwap 接上 `swapPane`**（修死碼）
- 理由：「每個 component 自己記得渲染 toolbar」= 現狀三份重複換檔案放，未來 pane type 作者會忘記掛；型別抓不到這種漏

### D5. Props 扁平、資料從窄 context 自取（否決 PaneRenderCtx）

- named component props 只有 `{ paneId, content }`；`mapNode` 的結構共享保證未變動 leaf 的 content identity 穩定（memo / React Compiler 友善）
- 資料各自取：SessionPane 用 `useTabState`；tool panes 用 cwd→identity lookup（worktree-centric D3）；callbacks 走 stable actions（D6 createSessionInPane 下沉後 identity 永久穩定）
- 否決理由：單一 fat ctx 的 churn——tabs 每次 status tick、ratio 拖曳每 frame 都換 identity，所有 pane 含 ChatView 全部重渲染；也違反本 codebase state/actions 分離的既有紀律

### D6. Zoom/mobile 修正：決策上移 PaneSplit

現狀 bug：`SplitPaneLeaf` 用 `hidden` 隱藏，但 split wrapper 的 percentage 與 divider 仍渲染——zoom 的 pane 被困在原格子。修正：

```
PaneSplit 渲染前判斷（zoomedPaneId ?? (isMobile ? focusedPaneId : null)）：
  目標只在 first 子樹  → 直接渲染 first（不渲染 wrapper %、divider、second）
  目標只在 second 子樹 → 同理
  無目標 / 兩側皆含    → 正常渲染
```

- 用既有 `hasLeaf`；PaneLeaf 只留 click-to-focus 與 data-pane-id
- 測試：jsdom 驗不到 layout——補 style 斷言或 Storybook/Playwright 視覺驗證 zoom 後佔滿 root

### D7. 空 session gate 修正

`TabContainer` 的 early return 改判「layout 是否為預設空狀態」（單一 workspace tab 且 paneRoot 為單一 empty session leaf），讓純 tool-pane layout 還原可見；全域空狀態 UI 由 SessionPane 的 EmptyPane 分支承擔。

### D8. RightPane 定位（已決策：ephemeral quick-view）

RightPane 是 session 附屬的 ephemeral quick-view（三合一 tabs、不入樹、不持久化、`rightOpen` 為 local state）。與 D5 follow-mode tool pane 功能重疊——**worktree-centric D5 落地後評估讓 `onToggleRight` 改為 split 出 follow-mode pane、RightPane 退役**；在那之前不動。

---

## 否決記錄（草案被批判推翻的決策，勿重蹈）

| 草案決策 | 否決理由 |
|---|---|
| deserialize 時判斷 session 存活（RestoreCtx） | `layout:sync` 路徑 sessions 可能未到 → 活 session 被判死 → 拆綁後的 layout 被 debounced save **寫回 server 並廣播**，B 的無知毀掉 A 的 layout；且 deserialize 有損 → echo guard 永遠比不相等 |
| merge-by-leaf-id「本地綁活 session 不拆綁」 | 想保護的 React mount 身份不存在（SplitPane 無 key、positional reconcile）；會永久擋掉 remote swap（換 content 不換 id），兩端互不收斂。改 LWW ＋ `key={node.id}` ＋ join 冪等 |
| 單一 PaneKind registry（Component＋serde 同綁） | contexts ↔ components runtime 循環 import；TabProvider 失去 standalone 測試 |
| PaneRenderCtx 集中注入 | god context churn：ratio 拖曳每 frame、tabs 每次 status tick 全 pane 重渲染 |
| EmptyPane 列為 registry 分支 | 它沒有 PaneContent type——是 session content 的 render 狀態 |
| SerializeCtx（serialize 查 tabs map） | save effect deps 只有 `[wsState]`，timer fire 時 tabs 必然 stale。改為綁定當下把 cwd 寫進 content |

## 情境覆蓋（16 項驗收）

1 單一 leaf ✓（closePane guard）｜2 巢狀 split ✓｜3 ratio 拖曳 ✓（debounce 吸收）｜4 zoom ✓（D6 修正後真正放大）｜5 focus ✓｜6 mobile ✓（與 zoom 同機制）｜7 DnD swap ✓（D4 接上 onSwap）｜8 close 兄弟提升 ✓｜9 session live/empty/dead ✓（D3 render-time）｜10 worktree 已刪/listing 未載 ✓（deserialize permissive＋render 警示）｜11 worktrees pane ✓（窮舉）｜12 RightPane ✓（D8）｜13 split 空 leaf ✓｜14 splitPaneAndAssign ✓（簽名加 cwd）｜15 還原不拆綁 ✓（D3＋key={node.id}）｜16 terminal/follow ✓（terminal 是 bottom panel 不入樹；follow 已預留 target.kind）
