# Preferences Axis Alignment — Proposal

## Why

CLAUDE.md 指定 `tokens/App.proposal.css` 為 design token 權威。CSS token 已同步（font-scale/density 覆寫/roast/palette），但 **TypeScript 偏好型別、DOM 同步、feature UI、快捷鍵**仍停在舊值域——使用者切不到 roast 主題、xl 字級、relaxed 密度，字級快捷鍵不存在。

## What Changes

把偏好三軸的 **runtime 層**對齊 design 定案（§4c）：

1. **ColorTheme**：`dark|light|system` → `clay-dark|light|roast|auto`；`EffectiveColorTheme` 加 `roast`（非 light/dark 二分——roast 是獨立暗色系）；auto = `prefers-color-scheme`（light↔clay-dark）
2. **FontSize**：`sm|md|lg` → `s|m|l|xl`；App.tsx sync 改寫 `ds.fontsize = fontSize`（取代 `ds.font`）；保留舊 `data-font` 相容（不刪 CSS）
3. **Density**：`comfortable|compact` → `compact|default|relaxed`
4. **快捷鍵**：⌘=/⌘-/⌘0（字級放大/縮小/重設）；statusline 短暫 toast 目前字級
5. **theme 切換過渡**：bg/text/border 加 `transition: var(--theme-transition)` CSS rule
6. **localStorage migration**：舊值（`dark→clay-dark`、`sm→s`、`comfortable→default`）在 store hydrate 時自動轉換

## Impact

- `preferences-schema.ts`、`usePreferencesStore.ts`、`App.tsx`（dataset sync）
- `font-size-feature.ts`、density feature、color-theme feature（feature UI items）
- `SettingsDialog.tsx`（選項清單）
- `KeyboardShortcutsProvider.tsx`（⌘=/⌘-/⌘0）
- `App.css`（theme transition rule）
- 測試：App.css.test（已有 T6-T10）＋store hydrate migration test＋快捷鍵 test
