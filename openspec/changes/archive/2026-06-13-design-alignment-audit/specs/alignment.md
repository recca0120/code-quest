# Spec: Design Alignment

## Requirements

每項修正必須：
1. 先寫/改測試到目標態（RED）
2. 改 production code 讓測試通過（GREEN）
3. Token 權威源為 `docs/design/design_handoff_tmux_workspace/tokens/App.proposal.css`
4. 行為規格源為 `docs/design/design_handoff_tmux_workspace/README.md`
5. 測試用 fake-summoner-client harness（renderWithWorkspace / renderWithChannel）

## Acceptance Criteria

- [ ] Tablet 斷點 640px 生效
- [ ] Drawer diffstat 顯示
- [ ] Logo text 640px 以上可見
- [ ] Tab busy dot DOM 常駐
- [ ] Pane focus border mix transparent
- [ ] Split reject 有 toast
- [ ] Rail hint 完整顯示
- [ ] Palette min-width 90vw
- [ ] Drawer pin 是 primary style
- [ ] Git count 有 + 前綴
