# Preferences Axis Alignment — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline＋priming＋UI 驅動＋多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）


TDD：每項先測試（RED）再實作。測試照 fake-summoner-client skill。

## 1. ColorTheme 對齊

- [ ] 1.1 [test] preferences-schema：ColorTheme 為 `clay-dark|light|roast|auto`；preferencesStateSchema parse 舊值 `dark` → `clay-dark`、`system` → `auto`（migration）
- [ ] 1.2 [impl] colorThemeSchema 改值域；usePreferencesStore hydrate migration（onRehydrateStorage 或 migrate）
- [ ] 1.3 [test] App.tsx：`ds.theme` 反映 effective theme（auto 解析 prefers-color-scheme → clay-dark 或 light；roast 直出 roast）
- [ ] 1.4 [impl] App.tsx effectiveColorTheme 邏輯（EffectiveColorTheme 加 `roast`）；`ds.theme` sync
- [ ] 1.5 [test] color-theme-feature items = clay-dark/light/roast/auto 四項
- [ ] 1.6 [impl] createColorThemeFeature 更新

## 2. FontSize 對齊

- [ ] 2.1 [test] FontSize type 為 `s|m|l|xl`；store migration `sm→s`、`md→m`、`lg→l`
- [ ] 2.2 [impl] fontSizeSchema + migration
- [ ] 2.3 [test] App.tsx：`ds.fontsize` 寫入（取代 `ds.font`）；舊 `ds.font` 也同步寫（向後相容）
- [ ] 2.4 [impl] App.tsx sync
- [ ] 2.5 [test] ⌘=/⌘-/⌘0 字級快捷鍵（⌘= 往上一檔、⌘- 往下一檔、⌘0 重設 m）
- [ ] 2.6 [impl] KeyboardShortcutsProvider 接線 + statusline toast

## 3. Density 對齊

- [ ] 3.1 [test] Density type 為 `compact|default|relaxed`；migration `comfortable→default`
- [ ] 3.2 [impl] densitySchema + migration；`ds.density` sync 不變（attr 值直接用新型別值）
- [ ] 3.3 [test] density feature items 三項（compact/default/relaxed）
- [ ] 3.4 [impl] createDensityFeature 更新

## 4. Theme 切換過渡

- [ ] 4.1 [test] App.css：bg/text/border 有 transition（`var(--theme-transition)`）；reduced-motion 歸零後不動
- [ ] 4.2 [impl] App.css @layer base 加 transition rule

## 5. 收尾

- [ ] 5.1 [verify] 全套綠 + Playwright：切 roast → bg #14100c；切 xl → font-scale 1.15 生效；切 relaxed → tabbar 42px；⌘= → 字級升一檔
