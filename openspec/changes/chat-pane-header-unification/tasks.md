# Chat Pane Header Unification — Tasks

TDD；測試照 fake-summoner 全真寫法。

- [x] 1.1 [test] chat 全版：SessionPane 內容 wrapper 撐滿（flex-1）；Playwright 量測 composer 底貼 pane 底
- [x] 1.2 [impl] SessionPane wrapper `h-full` → `flex-1 min-h-0`
- [x] 2.1 [test] pane header tools：☰／⊞ 按鈕在 pane header 內（aria-label 契約不變）、⊞ toggle rail 行為不變
- [x] 2.2 [impl] SessionPane 經 PaneShell tools slot 渲染 ☰／⊞；ChatView/TabContent 移除 breadcrumb 與對應 props
- [x] 2.3 [test+impl] ChatBreadcrumb／ResumeButton 刪除；測試等價遷移（tab-identity ④→pane header、breadcrumb 測試刪、ChatView.test 更新）
- [x] 2.4 [verify] 全套綠＋knip＋Playwright（單一 header、chat 全版、rail toggle）
