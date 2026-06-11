# Unified Command Entry — Proposal

## Why

Design 定案（§4b）：⌘K 是 **PanePicker 與 Command Palette 的共用入口**——預設顯示 PanePicker（搜 pane/worktree），輸入 `›` 前綴切到指令模式（theme/字級/density/訊息搜尋都是指令）。

Production 現況：⌘K 開 PanePicker、⌘⇧K 開 CommandPalette——兩個獨立 modal。

## What Changes

1. **合併入口**：⌘K 唯一；PanePicker 搜尋列偵測 `›` 前綴切到指令模式（feature items 來自 CommandPalette 既有的 feature registry）
2. **共用 modal shell**：外殼尺寸接 `--palette-w/max-h` tokens（已在 App.css）；PanePicker 三欄佔 980px、指令列表佔 640px（shell 動態寬）
3. **⌘⇧K 移除**（或改為直接開指令模式——跳過 PanePicker 直達 `›`）
4. **CommandPaletteContext 簡化**：open state 合併入 PanePicker 的 open state；feature items 保留（注入 PanePicker 指令模式）

## Open Questions（需要你決策）

- 訊息搜尋（CommandPalette 現有功能）在統一入口的位置？選項：(a) ⌘K 輸入文字直接搜（與 worktree 搜尋合併）(b) `›search` 指令觸發 (c) 獨立快捷鍵（如 ⌘F）
- ⌘⇧K 完全移除或保留為「直開指令模式」快捷鍵？

## Impact

- PanePicker.tsx（搜尋列 + 指令模式 view）
- CommandPalette.tsx（可能整合進 PanePicker 或變 headless provider）
- CommandPaletteContext.tsx
- Workspace.tsx（入口接線）
- KeyboardShortcutsProvider.tsx
