# Design: Design Alignment Audit

## Approach

純 TDD 重構——每個偏差先改測試到目標態（RED），再改 production code（GREEN）。由於是對齊 design spec，expect 應反映 spec 定義的值。

## 決策

| 決策 | 理由 |
|------|------|
| `--radius-chip` 維持 4px | App.proposal.css 定義為 4px，README §2 寫 5px，token 權威（proposal）勝過 README 文字 |
| `--text-header` 維持 11.5px | App.proposal.css 定義 `calc(11.5px * var(--font-scale))`，README 寫 12px，同上 |
| Icon 維持 Heroicons | README §Assets 明確建議「實作時建議換成 repo 既用的 heroicons 對應款」 |
| Statusline busy dot 維持 6px | Code 已有 deliberate choice 註解，統一 tab/statusline |
| 中英文 label 不改 | 這是 i18n 議題，不在此 change 範圍 |

## 實際要修的項目（16 項）

1. **RWD-breakpoint**: `useTabletMode()` 下限 768→640
2. **drawer-diffstat**: DrawerHost header 加 diffstat 顯示
3. **logo-visibility**: 移除 `hidden md:inline`，改用 `sm:` 或永遠顯示
4. **tab-busy-dot**: 改為 `visibility: hidden/visible`，DOM 常駐
5. **pane-focus-border**: mix 對象 `--color-border` → `transparent`
6. **permission-mode-str**: 確認 server 值與 CSS selector 一致
7. **split-reject-toast**: guardSplitMinSize 失敗時 toast
8. **rail-hint-always**: hint 文字無條件渲染（移除 onPromote 條件）
9. **palette-min-width**: 加 `min-w-[90vw]` 或 token
10. **drawer-pin-primary**: pin 按鈕改 filled primary style
11. **git-count-prefix**: dock/rail git count 加 `+` 前綴
12. **rail-extra-button**: 評估移除 header 內多餘的 drawer 按鈕
13. **dock-hint-mobile**: mobile dock hint 對齊 spec
14. **stale-comment**: density comment `comfortable` → `default`
15. **pane-gap-impl**: 確認 divider 實作等效 gap:6px（若等效則 pass）
16. **picker-col-breakpoint**: 確認 560px 退化行為
