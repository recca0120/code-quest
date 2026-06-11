# Mobile RWD Polish — Design

## MobileTopBar（B2）

```
┌─────────────────────────────────────┐
│ [main ▾]    ① ② ③      [⊞]        │  ← 44px, bg-surface, border-b
└─────────────────────────────────────┘
```

- **左**：當前 workspace tab 名（truncate 10ch）+ ▾ dropdown → 列出所有 tabs，切換 = `setActiveTab`
- **中**：pane 編號 dots — `leafIdsInOrder` 衍生；focused 加 accent 底色；點擊 = `focusPane`
- **右**：⊞ 按鈕開啟 `MobilePaneWall`（取代現有浮動按鈕）
- 高度 44px（handoff hit-min），`position: sticky; top: 0; z-sticky`
- 只在 mobile mode 渲染（`useMobileMode()`）

## 卡片牆 Preview 縮影（B3）

現有 `MobilePaneWall` 卡片只顯示 leafLabel 文字。增強：

```
┌──────────────────┐
│ ① ●         [×]  │  ← 編號 + busy dot + close
│                   │
│ ✦ main            │  ← 類型 icon + label
│ "最後一則訊息…"   │  ← preview line (chat: last msg; tool: cwd)
│                   │
└──────────────────┘
```

- **chat pane**：最後一則 assistant message 的 preview（`messagePreview()` truncate 60ch）
- **tool pane**：PANE_TYPE_REGISTRY icon + cwd basename
- **＋ 新增卡**：底部虛線卡，點擊開 picker

Preview 資料來源：
- chat → `useTabState().tabs[sessionId]?.title` 或 channels store 最後一則
- tool → `PaneNode.content.target.cwd` basename

## 整合

`TabContainer` 的 mobile 渲染順序：
```
<MobileTopBar />         ← 新增
<PaneLeaf (focused) />   ← 現有
<MobilePaneWall />       ← 增強（preview + ＋ 卡）
```

MobileTopBar 取代 MobilePaneWall 的浮動 ⊞ 按鈕位置（按鈕移到 topbar 右側）。
