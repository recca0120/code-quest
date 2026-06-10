# design-tokens Spec

## ADDED Requirements

### Requirement: App.proposal.css 取代 @theme 段

`apps/web/src/App.css` 的 `@theme` token 段 SHALL 以 `docs/design/tokens/App.proposal.css` 為準替換（V1 陶土暗為預設、`data-theme="light"` 為紙亮）。既有 token 名 SHALL 保持相容（短別名 `--color-input`/`--color-muted` 等保留）；被刪除的 `--color-toggle`/`--color-button` 的 consumer SHALL 改用 `--color-accent`（按鈕）與 `--color-info`（plan/連結）。

#### Scenario: token 替換後全套件不壞
- **WHEN** 替換 @theme 段並跑全 vitest 套件
- **THEN** 全綠（測試斷言 semantic token 名而非色值，不受換色影響）

### Requirement: 元件 tokens 與 motion tokens

pane/tab/statusline/drawer/dock/picker/motion/RWD 的元件 tokens（`--pane-header-h: 30px`、`--tabbar-h: 38px`、`--statusline-h: 26px`、`--dur-fast/base/drawer`、`--ease-out-soft`、`--breakpoint-sm/lg` 等，完整清單見 App.proposal.css）SHALL 進入 @theme 並被元件以 token 引用，不得硬編像素值。

#### Scenario: prefers-reduced-motion 全關動效
- **WHEN** 使用者系統設定 prefers-reduced-motion
- **THEN** pane 開合/重排/drawer 動效時長為 0
