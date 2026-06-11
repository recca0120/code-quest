# Design Alignment Audit — Design

## 修正策略

所有修正以 design handoff README.md + tokens/App.proposal.css 為權威源。
修正範圍限於「對齊」——不新增功能、不重構架構。

## Token 修正

| Token | 現值 | 目標值 | 影響 |
|---|---|---|---|
| `--radius-chip` | 4px | 5px | 編號徽章圓角 |
| `[data-theme="dark"]` 選擇器 | `dark` | `clay-dark` | theme 切換後色彩覆寫 |
| `--theme-transition` reduced-motion | 未歸零 | 補 0ms | a11y |

## 字級修正

| 元件 | 現值 | 目標值 | class 修正 |
|---|---|---|---|
| Pane header 標題 | `text-xs`(14px) | `--text-ui`(12px) | `text-[length:var(--text-ui)]` |
| Statusline | `text-2xs`(10px) | `--text-statusline`(10.5px) | `text-[length:var(--text-statusline)]` |
| Rail tab label | `text-2xs`(10px) | 11px | 新 token 或 `text-[11px]` |
| Dock chip label | `text-2xs`(10px) | 11px | 同上 |
| MobileTopBar pane dots | `text-sm`(14px) | 22px | 新 token 或 tailwind utility |

## Dead Code 清理

- `ds.font = fontSize` + `[data-font="sm|md|lg"]` CSS → 移除
- test 名殘留 "SessionBar" → 重命名
- `registerActions` / `paletteActions` → 移除（CommandPalette 已不 mount）
- `useCommandPalette()` 合體 hook → 移除（改用拆開的 hooks）
- 過期 comment（SessionBar、comfortable、dark）→ 更新
