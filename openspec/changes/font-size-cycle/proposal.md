## Why

Design §4c 描述 font-size 用「循環 s/m/l/xl」，但 production 實作是到底停住（xl 時 ⌘= 無效、s 時 ⌘- 無效）。需改為循環：xl → ⌘= → s、s → ⌘- → xl。

## What Changes

`KeyboardShortcutsProvider.tsx` 的 ⌘=/⌘- 邏輯：
- 現狀：`if (idx < SIZES.length - 1)` 到底停住
- 目標：到底後 wrap 回起點（循環）

## Out of Scope
- ⌘0 重設到 m（不變，不循環）
