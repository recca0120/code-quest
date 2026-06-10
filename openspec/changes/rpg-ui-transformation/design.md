## Context

cc-office 前端目前以 Classic chat UI 呈現 Claude Code session，底層領域模型（battle、map、party、subagent）已有 RPG 語彙（見 `battle-management`、`map-system` skills）但未在 UI 反映。使用者對 subagent、MCP、context budget、permission prompt 等抽象功能缺乏直觀認知。本 change 在不拆除既有 UI 的前提下，疊加 RPG 外殼（Dragon Quest 風），透過 mode toggle 切換。

相關既有模組：`layout-shell`、`command-menu-structure`、`rewind-dialog`、`mobile-nav`，以及 `packages/client/src` 的 channel / socket 基礎設施。

## Goals / Non-Goals

**Goals:**
- 提供完整 RPG mode UI，涵蓋 project list → session picker → battle screen 三層動線
- 將抽象功能視覺化：context=HP、token=MP、cost=G、subagent=仲間、MCP=契約魔獸、compact=宿屋
- 保留 Classic mode 作為一等公民 fallback，功能不減
- i18n 骨架就位，之後加日/英文只是新增 locale 檔
- 高頻操作（打字、複製 code block、scroll 歷史）不因美化而變慢

**Non-Goals:**
- 不做 gamification 獎勵（等級提升不解鎖實際功能）
- 不重寫 chat / streaming / socket 核心邏輯
- 不支援自訂主題（v1 只有 DQ 風一種 RPG skin）
- 不做多人連線 / 公會等社交系統
- 不實作本 change，僅產出 requirements / design / tasks；實作分階段於後續 change

## Decisions

### D1. Mode toggle：新增 shell 而非 fork 路由
Classic 與 RPG 共用同一組 route 與 data layer，只在 `<AppShell>` 層根據 `useAppMode()` 挑選呈現元件。RPG 元件透過 React.lazy 切分，Classic mode 不載入。
- 替代：維持兩套路由 → 狀態同步複雜，棄用。

### D2. 史萊姆 sprite 狀態機用 XState 或簡易 reducer？
採簡易 reducer（`useReducer`），狀態有限（idle/thinking/tool-use/error/done/sleeping/poisoned/confused），以既有 socket event 為輸入。XState 過重。

### D3. Sprite / 音效資產
- Sprite：採 CC0 像素 pack（如 [Liberated Pixel Cup](https://lpc.opengameart.org/) 或 opengameart.org slime），避免 DQ 官方素材版權問題
- 字體：PixelMplus（優先，OFL 授權）
- 音效：opengameart.org CC0 chiptune SFX
- 所有資產放 `packages/client/public/rpg/`，bundle 按場景 lazy load

### D4. HUD 資料來源
- HP（context 剩餘）：從 session token 累積推算，對照目前 model context window（claude-opus 200k / sonnet 200k）
- MP（token budget）：若使用者未設定 budget，顯示為「∞」
- G（cost）：串接既有 usage 統計
- LV（對話數）：session message count

### D5. i18n 方案
採輕量 key-value，不引入 i18next。建立 `packages/client/src/rpg/i18n/{zh-TW,ja,en}.ts`，透過 `useRpgText(key)` 讀取。Key 用日文原文命名（`menu.battle` / `status.doku`），利於 DQ 語感，也方便日文 locale 直接對應。

### D6. 指令選單與鍵盤
底部四格 DQ 藍框選單支援：
- 滑鼠點擊
- 方向鍵上下左右 + Enter 確定、Esc 取消
- 快捷鍵 1/2/3/4
預設焦點在「戰鬥」（prompt 輸入），Enter 直接 submit，降低操作成本。

### D7. 音效策略
預設 mute，首次進入 RPG mode 彈一次「開啟音效？」提示，偏好存 localStorage。Classic mode 不載入音效資產。

### D8. 轉場與效能預算
- 進入戰鬥轉場 ≤ 0.5s（縮圈黑幕）
- sprite 動畫使用 CSS transform + steps()，不走 canvas
- 音效單例 manager，WebAudio API 複用 buffer

### D9. Permission prompt = 習得咒文動畫
原 permission dialog 以 RPG mode 呈現為「〇〇は △△ のじゅもんを おぼえた！」動畫 + 同意/拒絕藍框選單；Classic mode 維持原 dialog。共用同一 data hook，避免邏輯分歧。

### D10. 實作分階段（本 change 不寫 code）
- Phase 1：rpg-ui-shell（卡帶列表、mode toggle、DQ 選單元件、i18n 骨架）
- Phase 2：rpg-battle-scene（史萊姆 sprite、底部選單、戰鬥記錄）
- Phase 3：rpg-hud + rpg-dialogs（HUD、permission、plan、todo、compact、error、auto-save）
- Phase 4：rpg-party + rpg-effects（仲間 sprite、契約魔獸、tool 動畫、音效）

每階段各自開獨立 change。

## Risks / Trade-offs

- **版權風險（DQ 官方素材）** → 明確採 CC0 / OFL 替代品，PR review 時驗資產出處
- **Bundle 變大** → RPG 元件全部 lazy load；Classic 使用者 0 成本
- **可用性退化（為了 DQ 犧牲速度）** → 守則：輸入框維持原生 textarea；所有高頻操作須 benchmark Classic vs RPG
- **Accessibility 受損（像素字 / 閃爍特效）** → 提供「減少動態效果」選項，尊重 `prefers-reduced-motion`；字體不低於 14px 等效
- **維護成本倍增（兩套 UI）** → 共用 data hooks / stores；只有 view 層分岐，不重寫業務邏輯
- **i18n key 用日文原文** → 對英文母語開發者較不友善，但能保留 DQ 語感且對應明確；加註解 mapping
- **多階段交付中 UI 不一致** → 每個 phase change 須維持 RPG mode 可用，不可半成品發布

## Migration Plan

1. 後續 change 逐步實作，每 phase 合併後 RPG mode 可獨立運作
2. Feature flag `APP_MODE_RPG_ENABLED`（預設 true on dev，false on prod 直到 Phase 2 完成）
3. 回滾：移除 mode toggle，把 Classic 設為唯一 shell；RPG 目錄保留不影響 Classic
4. Telemetry：記錄 mode toggle 事件，觀察採用率

## Open Questions

- 是否需要「像素字 / DQ 字」與「系統字」切換，滿足 a11y？
- Subagent sprite 造型要統一（all 仲間）還是依 subagent type 不同（Explore / Plan / code-review）？
- HUD 的 HP/MP 數字在 context 無法準確測得時如何降級顯示？
- 音效授權清單是否需要在 README / 關於頁列明？（建議是）
