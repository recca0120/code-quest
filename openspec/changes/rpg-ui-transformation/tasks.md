> Note: This change produces the three-layer docs only. Implementation is split into downstream changes per phase (see design.md §D10). Each phase below is scaffolded here and will be expanded into its own change before coding starts.

## 1. Groundwork & Assets

- [ ] 1.1 決定並下載 CC0/OFL 授權的史萊姆 sprite pack，放到 `packages/client/public/rpg/sprites/`
- [ ] 1.2 決定並下載 PixelMplus 或 美咲フォント（OFL），放到 `packages/client/public/rpg/fonts/`
- [ ] 1.3 決定並下載 CC0 chiptune SFX pack（menu/confirm/damage/victory/rest 等），放到 `packages/client/public/rpg/audio/`
- [ ] 1.4 在 README 或 ABOUT 頁面記錄資產授權清單
- [ ] 1.5 新增 `APP_MODE_RPG_ENABLED` feature flag（dev on / prod off）

## 2. Phase 1 — rpg-ui-shell

- [ ] 2.1 新增 `useAppMode()` hook + mode store（localStorage 持久化，預設 classic）
- [ ] 2.2 `<AppShell>` 依 mode 挑選 Classic / RPG 呈現元件，RPG 走 React.lazy
- [ ] 2.3 Settings 與 RPG せつめいしょ 選單新增 mode toggle 入口
- [ ] 2.4 實作 `DQMenu` 元件（藍框、鍵盤上下左右+Enter+Esc、1–4 數字鍵、滑鼠）
- [ ] 2.5 實作 Cartridge 卡帶 UI 與 project list RPG 變體
- [ ] 2.6 實作 project entry menu（新冒險 / 讀取紀錄 / 設定）
- [ ] 2.7 實作 session picker（DQ 三格ぼうけんのしょ + 分頁）
- [ ] 2.8 i18n 骨架：建立 `rpg/i18n/{zh-TW,ja,en}.ts` 與 `useRpgText` hook
- [ ] 2.9 尊重 `prefers-reduced-motion` 與 ≥14px 最小字體
- [ ] 2.10 Storybook story 覆蓋 DQMenu / Cartridge / SessionPicker
- [ ] 2.11 Phase 1 測試：component test (RTL) + i18n fallback test

## 3. Phase 2 — rpg-battle-scene

- [ ] 3.1 實作史萊姆 sprite 元件與狀態 reducer（idle/thinking/tool-use/error/done/sleeping/poisoned/confused）
- [ ] 3.2 將既有 socket event / session 狀態 map 成 sprite state
- [ ] 3.3 實作底部指令選單（戰鬥/魔法/道具/作戰/逃跑）+ 預設焦點戰鬥 + 快捷鍵
- [ ] 3.4 prompt 輸入維持原生 textarea，只套 DQ 外框
- [ ] 3.5 實作右側可收合「戰鬥記錄」panel，整合既有 MessageList 與 auto-scroll 行為
- [ ] 3.6 實作進入戰鬥轉場（縮圈黑幕 ≤ 500ms）
- [ ] 3.7 魔法選單串 skills、道具選單串 worktree、作戰選單串 system prompt
- [ ] 3.8 逃跑觸發 abort + 顯示「しかし まわりこまれてしまった！」失敗訊息
- [ ] 3.9 Storybook 覆蓋 sprite 各狀態
- [ ] 3.10 測試：sprite 狀態轉換 / 選單鍵盤 / abort / code block 複製同於 Classic

## 4. Phase 3 — rpg-hud + rpg-dialogs

- [ ] 4.1 實作 HUD：HP/MP/G/LV 四欄 + 降級顯示 (`???` / `--` / `∞`)
- [ ] 4.2 串接 context / token / cost / message count 資料來源
- [ ] 4.3 HP < 15% 閃紅 + compact 建議提示
- [ ] 4.4 Permission prompt「習得新咒文」動畫 + 藍框 許可/拒否 選單（與 Classic dialog 共用 data hook）
- [ ] 4.5 Plan mode「作戰會議」場景
- [ ] 4.6 TodoWrite「クエスト一覧」羊皮紙渲染
- [ ] 4.7 `/compact` 宿屋動畫 + HP 回滿
- [ ] 4.8 Error recovery / rewind 教會復活動畫
- [ ] 4.9 Auto-save flash「ぼうけんのしょ に きろくします」
- [ ] 4.10 測試：HUD 降級、permission approve/deny 與 Classic 行為一致、compact 前後 HP 同步

## 5. Phase 4 — rpg-party + rpg-effects

- [ ] 5.1 實作 subagent 仲間 sprite：delegate 時出場、完成時淡出
- [ ] 5.2 實作 MCP 契約魔獸 icon + tooltip + 斷線 greyed out
- [ ] 5.3 CLI provider 切換更新主角 sprite 配色/變體
- [ ] 5.4 Tool 動畫：Bash 劍擊 / Read 調查 / Write 魔法陣 / WebFetch 召喚
- [ ] 5.5 狀態異常特效：どく / ねむり / こんらん
- [ ] 5.6 Audio manager（WebAudio 單例、buffer 複用、首次 opt-in、localStorage 持久化）
- [ ] 5.7 SFX：menu / confirm / cancel / damage / victory / rest / quest-complete
- [ ] 5.8 驗證 Classic mode 不載入任何 `/rpg/` 資產（network panel 檢查 + 自動化測試）
- [ ] 5.9 併發 tool 動畫效能測試（無 overlap jitter）
- [ ] 5.10 測試：reduced-motion 下所有轉場收斂為 fade 或略過

## 6. Cross-cutting / Release

- [ ] 6.1 Telemetry：記錄 mode toggle 事件與 RPG 採用率
- [ ] 6.2 每個 phase 合併後在 RPG mode 跑完整 smoke test（project list → chat → tool call → compact → rewind）
- [ ] 6.3 Benchmark：RPG mode vs Classic 的打字延遲、MessageList scroll FPS
- [ ] 6.4 A11y 稽核：reduced-motion、字體大小、鍵盤可達性、色彩對比
- [ ] 6.5 將本 change 拆成 4 個 phase change（rpg-ui-shell-phase1、rpg-battle-scene-phase2、rpg-hud-dialogs-phase3、rpg-party-effects-phase4）分別提案
- [ ] 6.6 Phase 4 完成後把 `APP_MODE_RPG_ENABLED` prod flag 開啟
