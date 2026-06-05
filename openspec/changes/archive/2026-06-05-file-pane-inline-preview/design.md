## Context

FilesPane 原本用 `FilePreviewModal`（Dialog）顯示檔案內容，每次點擊都遮住整個畫面。本 change 改用從右側滑入的 `PreviewDrawer`，FileTree 保持可見，並加入 drag-to-resize 讓使用者可拖曳調整 Drawer 寬度。`PdfViewer` 同步修正了兩個既有 bug。

## Goals / Non-Goals

**Goals:**
- 點擊檔案改用 Drawer，FileTree 不被完全遮住
- Drawer 可拖曳 resize（左邊 handle）
- 修正 PdfViewer blob URL 問題與初始寬度跳動問題
- 維持全部現有測試通過

**Non-Goals:**
- 不持久化使用者調整的 Drawer 寬度（不存 localStorage）
- 不支援行動裝置的 BottomSheet fallback（留給後續）

## Decisions

**PreviewDrawer 是純 UI component，不負責資料拉取**
- `PreviewDrawer` 接受 `state: PreviewState`（loading / ready / pdf / image / error）從外部傳入
- 資料拉取（RPC）由呼叫者（FilesPane）負責，組好 `state` 後傳給 `PreviewDrawer`
- 好處：`PreviewDrawer` 可被任何人重用（openspec preview、其他 pane），不綁定 socket / file 概念
- 好處：測試 `PreviewDrawer` 不需要 mock socket，直接傳 `state` prop 即可

**actions 用 ReactNode prop，不內建業務按鈕**
- `onMention` 是 FilesPane 特有概念，`PreviewDrawer` 不知道「mention」是什麼
- 呼叫者透過 `actions?: ReactNode` 傳入任意按鈕（Mention + Copy path、或 openspec 自己的動作）
- `PreviewDrawer` 只負責把 `actions` render 在底部 footer

**Drawer 使用 Radix Dialog（非自製 fixed div）**
- 自帶 focus trap、`aria-modal`、Escape 關閉、overlay click 關閉，無障礙支援完整

**Resize 使用 pointer events 手刻（不用 react-resizable-panels）**
- `react-resizable-panels` 設計給 document flow 的 panel layout，不適合 fixed-position drawer
- 專案自己也曾因此移除過該套件（WorkspaceLayout.tsx 有 comment）
- 手刻 `onPointerDown` → `document` pointermove/pointerup 約 20 行，簡單可靠

**PdfViewer：`useMemo` → `useState` + `useEffect` for blob URL**
- React Strict Mode 下 useMemo 可能快取已被 revoke 的 URL
- `useLayoutEffect` 同步讀取初始寬度，取代 ResizeObserver 作為第一次量測

**PDF parent 不加 `overflow-auto`**
- 父層 overflow-auto 在 PDF 渲染後 scrollbar 出現/消失會改變 viewportRef 寬度，觸發 ResizeObserver → PDF 跳動

## Component 職責分界

```
FilesPane
│  負責: cwd probe、git marks、handleActivate
│        RPC fetch → 組 PreviewState
│        管理 previewPath、previewState state
│
├── FileTree
└── PreviewDrawer  (純 UI，可重用)
      props: open, onClose, title, state: PreviewState, actions?: ReactNode
      state: drawerWidth (resize), viewMode (markdown toggle)
      負責: drawer 外殼 (Radix Dialog)、resize handle
            根據 state.kind 選擇 renderer
```

## Risks / Trade-offs

- [Radix Dialog 在 portal 中的 aria-hidden] → FileTree 在 Drawer 開啟時被設為 aria-hidden，測試需用 `{ hidden: true }` 查詢
- [PreviewState 型別共用] → FilesPane 和 PreviewDrawer 共用同一個 PreviewState type，type 定義需放在適當位置讓兩者都能 import

## Migration Plan

1. 新增 `PreviewDrawer.tsx`（純 UI，接受 state prop，含 resize）
2. `FilesPane.tsx` 承接 RPC fetch 邏輯，管理 previewState，改用 `PreviewDrawer`
3. 修正 `PdfViewer.tsx`
4. 更新對應測試
5. 刪除 `FilePreviewDrawer.tsx`（原有的 data-fetching 版本）
