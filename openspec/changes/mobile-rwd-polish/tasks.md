# Mobile RWD Polish — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline＋priming＋UI 驅動＋多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. MobileTopBar（B2）

- [x] 1.1 [test] mobile mode → MobileTopBar 渲染；非 mobile → 不渲染
- [x] 1.2 [impl] MobileTopBar 骨架（sticky top, 44px, bg-surface）+ useMobileMode 條件
- [x] 1.3 [test] tab 下拉：顯示當前 tab 名；點擊展開 dropdown 列出所有 tabs；選擇切換
- [x] 1.4 [impl] tab dropdown（useWorkspaceTabState + setActiveTab）
- [x] 1.5 [test] pane dots：顯示 leaf 數量的 ①②③ dots；focused 加 accent；點擊切換 pane
- [x] 1.6 [impl] pane dots（leafIdsInOrder + focusPane）
- [x] 1.7 [test] ⊞ 按鈕開啟 MobilePaneWall
- [x] 1.8 [impl] ⊞ 按鈕接線 + MobilePaneWall 浮動按鈕移除

## 2. 卡片牆 Preview 縮影（B3）

- [x] 2.1 [test] chat pane 卡片顯示最後訊息 preview（truncate）
- [x] 2.2 [impl] 卡片 preview — chat: tabs[sessionId].title / messagePreview
- [x] 2.3 [test] tool pane 卡片顯示 registry icon + cwd basename
- [x] 2.4 [impl] 卡片 preview — tool: PANE_TYPE_REGISTRY icon + basename
- [x] 2.5 [test] ＋ 新增卡點擊開 picker
- [x] 2.6 [impl] ＋ 卡片 + onOpenModal 接線

## 3. 收尾

- [x] 3.1 [verify] 全套綠 + mobile viewport 模擬驗收
- [x] 3.2 [cleanup] 移除 MobilePaneWall 的舊浮動 ⊞ 按鈕（若已遷移到 TopBar）
