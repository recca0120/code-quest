# Font Size Cycle — Tasks

## 開發紀律（所有 change 共通）
- **TDD**：先測試（RED）再實作（GREEN）；行為刪除先盤點測試引用
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first＋no literal-px arbitrary）

## 1. ⌘= 循環

- [ ] 1.1 [test] font-size 為 xl 時 ⌘= → 循環回 s（非停住）
- [ ] 1.2 [impl] KeyboardShortcutsProvider：⌘= 的 idx 計算改用 modulo wrap

## 2. ⌘- 循環

- [ ] 2.1 [test] font-size 為 s 時 ⌘- → 循環到 xl（非停住）
- [ ] 2.2 [impl] KeyboardShortcutsProvider：⌘- 的 idx 計算改用 modulo wrap

## 3. 收尾

- [ ] 3.1 [verify] tsc clean + vitest green
