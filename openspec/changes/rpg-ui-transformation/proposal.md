## Why

cc-office 的戰鬥、地圖、隊伍等領域模型（battle-management、map-system、subagents）本來就走 RPG 隱喻，但目前 UI 仍是標準 chat 介面，無法傳達這層敘事，也讓 subagent、MCP、context budget 等抽象概念難以理解。把介面改造成 Dragon Quest 風格的 RPG 體驗，能讓功能語意視覺化（HP = context、仲間 = subagent、宿屋 = compact），同時讓產品調性與「Code Quest」品牌一致。

## What Changes

- 新增 **RPG mode** UI 外殼，與現有 Classic mode 並存；使用者可切換，預設 Classic，存 localStorage
- Project 列表改為 SFC 卡帶外觀；點選卡帶進入 DQ 藍框選單（新冒險 / 讀取紀錄 / 設定）
- Session 選擇畫面採 DQ 三格「ぼうけんのしょ」存檔風格
- Chat 畫面改為戰鬥畫面：史萊姆 sprite 代表 Claude，狀態對應 idle / thinking / tool-use / error / done
- 底部 DQ 藍框指令選單：戰鬥(prompt) / 魔法(skills) / 道具(worktree) / 作戰(system prompt) / 逃跑(abort)
- 右側可收合「戰鬥記錄」對應既有 MessageList
- 新增 HP/MP/G/LV HUD：context 剩餘 / token budget / 累積 cost / 對話數
- Subagent 顯示為隊伍 sprite；MCP servers 顯示為契約魔獸
- Tool call 動畫化（Bash=劍擊、Read=調查、Write=書寫魔法陣、WebFetch=召喚）
- Thinking 發光詠唱特效；streaming 維持逐字
- 狀態異常視覺化：error=どく / rate limit=ねむり / context 滿=こんらん
- Permission prompt 做成「習得新咒文」動畫；plan mode 做成「作戰會議」
- Todo list 做成「クエスト一覧」羊皮紙
- `/compact` 動畫做成宿屋休息；error recovery 做成教會復活
- Auto-save 閃現「ぼうけんのしょ に きろくします」
- i18n 骨架：選單文案抽出，key 用日文原文命名，v1 提供中文文案
- 導入 PixelMplus / 美咲フォント（免費商用）與 CC0 chiptune 音效
- 輸入框仍為標準 textarea（僅外框 DQ 化），保留 code block 複製、歷史 scroll 等高頻操作
- Classic mode 完整保留作為 fallback，不可刪除或降級

## Capabilities

### New Capabilities
- `rpg-ui-shell`: RPG mode 外殼、mode toggle、卡帶 project list、DQ 選單元件、路由整合
- `rpg-battle-scene`: 戰鬥畫面佈局、史萊姆 sprite 狀態機、底部指令選單、可收合戰鬥記錄
- `rpg-hud`: HP/MP/G/LV 資源視覺化，資料來源對應 context / token / cost / session 統計
- `rpg-party`: Subagent 仲間 sprite、MCP 契約魔獸、CLI provider 種族切換視覺
- `rpg-effects`: Tool call 動畫、thinking 詠唱、狀態異常、轉場、音效系統
- `rpg-dialogs`: Permission 習得咒文、plan mode 作戰會議、todo クエスト、compact 宿屋、error 教會、auto-save 提示
- `rpg-i18n`: 文案資源抽離、日文 key 命名、locale 載入機制

### Modified Capabilities
- `layout-shell`: 新增 mode toggle 入口、RPG 外殼與既有 layout 並存

## Impact

- **Affected code**:
  - `packages/client/src/` — 新增 `rpg/` 目錄（components/scenes/sprites/audio/i18n）
  - `packages/client/src/routes` — project list、session picker、chat 三處新增 RPG 變體
  - `packages/client/src/hooks` — 新增 `useAppMode`、`useRpgAudio`、`useContextBudget` 等
  - `packages/client/src/stores` — 新增 app mode store；串接既有 session / project / socket state
- **Dependencies**: 新增 bitmap font（PixelMplus 或 美咲フォント）、CC0 sprite pack、CC0 chiptune pack
- **Performance**: sprite / 音效 lazy load，Classic mode 不載入 RPG bundle
- **Scope**: 本 change 只定義 requirements / design / tasks 三層文件，實作拆成後續 change 分階段交付（卡帶列表 → 戰鬥外殼 → HUD/互動 → 隊伍/特效）
