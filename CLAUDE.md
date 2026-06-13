## UI 設計規範
- Workspace 改版的設計規格在 docs/design/design_handoff_tmux_workspace/README.md，動 UI 前先讀
- Design tokens 以 docs/design/design_handoff_tmux_workspace/tokens/App.proposal.css 為準（取代 App.css @theme 段）
- 心智模型：workspace tab = tmux window、pane tree 可分割/拖曳/zoom、PanePicker 是唯一內容入口、無 session bar

## Epic 工作流
大型重構或跨多模組的變更，使用「主 change + 子 change」模式：
1. **建主 change**（design + spec only，不走 apply）—— 這是北極星，描述最終目標態和所有重構面向
2. **從主 change 的 spec 拆第一個子 change**：scope 限 1-3 檔案、< 200 行差異
3. **子 change 走完整週期**：`/opsx:ff` → `/opsx:apply`（TDD） → `/opsx:verify`（同時對照主 change spec） → `/opsx:archive`
4. **完成後問使用者要不要開下一個子 change**，依主 change spec 挑下一個優先項
5. **全部子 change 完成後 archive 主 change**
- 每個子 change 只做結構重組或只做行為變更，不混合
- verify 時除了對照子 change 自己的 spec，也要確認沒偏離主 change 的 design

## 開發紀律
- **TDD**：先寫測試（RED）→ 實作（GREEN）→ 重構；行為刪除/搬移類重構也要先盤點舊載體的行為清單（grep 測試引用），逐條判定消失或搬家，測試全部改到目標態之後才動實作；tsc 錯誤只當收尾 checklist，不可當開發驅動
- **測試寫法**：照 `.claude/skills/fake-summoner-client/SKILL.md`（全真 pipeline：createTestContainer → createFakeServer → createFakeSummoner → renderWithWorkspace；餵資料用 priming 不 vi.mock 自家 context；驅動走真 UI；多層驗證）
- **Tailwind**：照 `.claude/skills/tailwind-v4/SKILL.md`（token-first、no literal-px arbitrary、opacity modifier）
