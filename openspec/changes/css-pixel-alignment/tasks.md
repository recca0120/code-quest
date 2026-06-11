# CSS Pixel Alignment — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. Pane Header（CRITICAL）

- [x] 1.1 [impl] Pane.tsx toolbar 容器 font-size：`text-xs`(14px) → 新 token `--text-header: calc(11.5px * var(--font-scale))`
- [x] 1.2 [impl] Pane.tsx action buttons gap：`gap-0.5`(2px) → `gap-2`(8px) 就近取 design 7px
- [x] 1.3 [impl] Pane.tsx action button color：`text-muted` → `text-subtle`
- [x] 1.4 [impl] Pane.tsx branch meta font-size：`text-2xs`(10px) → 繼承 toolbar 的 11.5px（移除 text-2xs）

## 2. ZoomBar + Drawer（CRITICAL）

- [x] 2.1 [impl] ZoomBar.tsx 主文案 font-size：`text-xs`(14px) → `text-[length:var(--text-header)]`(11.5px)
- [x] 2.2 [impl] DrawerHost.tsx header title：`text-xs`(14px) → `text-[length:var(--text-ui)]`(12px)
- [x] 2.3 [impl] DrawerHost.tsx pin 按鈕：`bg-accent text-selected-text` → `bg-(--color-accent-soft) border-[color-mix(in_srgb,var(--color-accent)_45%,var(--color-border))] text-accent`
- [x] 2.4 [impl] ZoomBar.tsx bottom border：`border-accent/25` → `border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))]`

## 3. PanePicker（CRITICAL）

- [x] 3.1 [impl] PanePicker overlay 透明度：Dialog/PanePicker backdrop `bg-bg/60` → `bg-bg/38`
- [x] 3.2 [impl] PanePicker 搜尋列 padding：`px-2`(8px) → `px-4`(16px)；搜尋列 border：`border-border` → `border-border-subtle`
- [x] 3.3 [impl] PanePicker type card icon size：加 `text-base`(16px) 於 icon span
- [x] 3.4 [impl] PanePicker section-label font-weight：600 → 700（修 @utility section-label）
- [x] 3.5 [impl] PanePicker type card active border：`border-accent` → `border-[color-mix(in_srgb,var(--color-accent)_50%,var(--color-border))]`
- [x] 3.6 [impl] PanePicker type card padding：`py-2`(8px) → `py-2.5`(10px)；grid gap：`gap-1.5`(6px) → `gap-2`(8px)

## 4. SlideOverPane（CRITICAL）

- [x] 4.1 [impl] SlideOverPane 定位：`right-0 top-0 bottom-0` → `right-2.5 top-2.5 bottom-2.5`(≈10px inset)
- [x] 4.2 [impl] SlideOverPane 邊框：`border-l` → `border`（四邊）
- [x] 4.3 [impl] SlideOverPane 圓角：`rounded-l-(--radius-card)`(10px left) → `rounded-[12px]`（四邊 12px）
- [x] 4.4 [impl] SlideOverPane 背景：`bg-surface` → `bg-bg`
- [x] 4.5 [impl] SlideOverPane width：inline `'58%'` → `w-(--slideover-w)` 消費 token

## 5. MobileTopBar（CRITICAL）

- [x] 5.1 [impl] MobileTopBar 高度：`h-11`(44px) → 新 token `--mobile-topbar-h: 48px` + `h-(--mobile-topbar-h)`
- [x] 5.2 [impl] MobileTopBar pane dot：純文字 → 22×22 chip（bg-surface-hover, rounded-[7px], font-size 10px, bold）；active = accent bg + white text
- [x] 5.3 [impl] MobileTopBar tab dropdown：純文字 → pill 邊框（min-h-9, rounded-[9px], border border-border, bg-surface）

## 6. DropZones + Divider + Ghost（CRITICAL/WARNING）

- [x] 6.1 [impl] DropZones z-index：`z-raised`(1) → `z-[12]`
- [x] 6.2 [impl] DropZones label font-size：`text-2xs`(10px) → `text-[length:var(--text-label)]`(11px)
- [x] 6.3 [impl] DropZones label color：`text-accent` → `text-(--color-accent-strong)` 或加 token
- [x] 6.4 [impl] Divider hover/resizing bg：`bg-accent/10` → `bg-(--color-accent-soft)`(13%)
- [x] 6.5 [impl] Divider 把手 glyph font-size：`text-xs`(14px) → token 或就近取
- [x] 6.6 [impl] Ghost border：`var(--color-accent)` → `color-mix(in srgb, var(--color-accent) 60%, var(--color-border))`

## 7. TabBar 微調（WARNING）

- [x] 7.1 [impl] logo gap：`gap-1.5`(6px) → `gap-2`(8px)
- [x] 7.2 [impl] logo margin-right：`mr-2`(8px) → `mr-2.5`(10px)
- [x] 7.3 [impl] logo-mark font-weight：`font-bold`(700) → `font-extrabold`(800)
- [x] 7.4 [impl] logo-mark font-size：`text-2xs`(10px) → `text-[length:var(--text-label)]`(11px)

## 8. Statusline + Rail/Dock（WARNING）

- [x] 8.1 [impl] Statusline padding-x：`px-3`(12px) → `px-2.5`(10px)
- [x] 8.2 [impl] Rail tab count color：`text-accent` → `text-subtle`
- [x] 8.3 [impl] Rail tab count font-size：`text-2xs`(10px) → 新 token `--text-count: 9px` 或 text-[9px]
- [x] 8.4 [impl] Dock chip count color：`text-accent` → token accent-strong 或 text-accent（確認）
- [x] 8.5 [impl] Dock chip active border：`border-accent` → `border-[color-mix(in_srgb,var(--color-accent)_50%,var(--color-border))]`

## 9. MobilePaneWall + 雜項（WARNING）

- [x] 9.1 [impl] MobilePaneWall container padding：`p-4`(16px) → `p-3.5`(14px)
- [x] 9.2 [impl] MobilePaneWall card 圓角：`rounded-(--radius-card)`(10px) → `rounded-[12px]`
- [x] 9.3 [impl] MobilePaneWall toggle button：`size-9`(36px) `rounded-full` → `size-[38px] rounded-[10px]`

## 10. 收尾

- [x] 10.1 [verify] tsc clean + 全套 vitest green
- [x] 10.2 [verify] 瀏覽器手動比對：開 design HTML + production 並排確認
