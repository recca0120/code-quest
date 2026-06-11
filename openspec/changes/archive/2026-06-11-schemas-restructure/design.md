## Context

`packages/schemas` 是 summoner / server / web 的多方合約層。放在這裡的東西代表「改了這個，至少兩個 app 要跟著改」，TypeScript 編譯期強制同步。

掃描所有 export 的外部使用者後，判斷標準確立為：
- **2+ app 使用** → 留在 schemas（強制同步）
- **只有 1 app 使用** → 移到那個 app
- **0 個外部使用者** → 刪除或內聯（從未需要 export）

目前問題只是目錄結構沒有反映這個分類，所有 schema 平鋪在 `schemas/` 子目錄。

## Goals / Non-Goals

**Goals:**
- `packages/schemas/src/` 內部重組為 `server/`、`adapter/`、`shared/` 三層
- `common.ts` 按使用者歸屬拆分，無外部使用者的 export 內聯或刪除
- `preferences.ts` 搬到 `apps/web/src/`（唯一確認的 single-party case）
- 跨邊界 public API 完全不變

**Non-Goals:**
- 不把任何多方共用 schema 移出 schemas（ContentBlock、ControlResponse 等留在原處）
- 不改 schema 的欄位內容或驗證邏輯
- 不建立 ServerBlock 或其他 wrapper type

## Decisions

### 目標目錄結構

```
packages/schemas/src/
├── server/              ← server ↔ client 合約（C2S payload、S2C event）
│   ├── common.ts        ← channelIdPayload、cancelRequest、channelMetaCache、
│   │                      errorMessagePayload、speechToTextPayload
│   ├── blocks.ts        ← 原 message-blocks.ts（ContentBlock 是 server↔client 合約）
│   ├── socket-events.ts ← 原根層 socket-events.ts
│   ├── rpc.ts           ← 原 schemas/rpc.ts
│   ├── permission-mode.ts
│   └── ... (actions, auth, control, control-response, fs, fs-dirty, git,
│            hook, mcp, message, message-meta, message-payloads, message-stats,
│            message-stream, notification, openspec, plan, plugin, projects,
│            provider, question, session, settings, system, task, terminal, worktree)
│
├── adapter/             ← summoner ↔ server 合約（原 remote/ + transport/）
│   ├── common.ts        ← ControlResponse、ResolvedControlResponse（summoner↔server↔web 三方）
│   ├── remote/
│   │   ├── methods.ts
│   │   ├── protocol.ts
│   │   └── protocol-schemas.ts
│   └── transport/
│       ├── agent-transport.ts
│       ├── transport.ts
│       └── types.ts
│
├── shared/              ← 真正無歸屬的基礎建設
│   └── permission-mode.ts  ← server broadcast + client consume，無單一 producer
│
├── utils/               ← 不動
├── validators/          ← 不動
├── logger.ts / errors.ts / content-types.ts / process-provider.ts / topic-emitter.ts
└── index.ts             ← re-export 路徑更新，跨邊界 API 不變

apps/web/src/stores/
  preferences-schema.ts  ← preferences 搬來這裡
```

### ControlResponse 的歸屬

`ControlResponse` / `controlResponseSchema` 被 summoner、server、web 三方共用，是 summoner ↔ server control flow 的回傳格式，再透過 server 傳給 web。屬於 adapter 層（summoner ↔ server contract），但因為 web 也依賴它，放在 `adapter/common.ts` 並從 index.ts re-export。

### message-blocks.ts 的歸屬

`ContentBlock` 雖然是 Claude protocol 的原始格式，但 summoner、server、web 三方都依賴它。它是 server ↔ client 的 broadcast 合約（server 把 ContentBlock[] 廣播給 client），因此歸入 `server/blocks.ts`。這個目錄名稱反映它在合約裡的角色（server 定義 broadcast 內容），不代表 Claude 原始格式要改變。

### common.ts 拆分細節

| Export | 外部使用者 | 去向 |
|--------|-----------|------|
| `ControlResponse` / `controlResponseSchema` | summoner + server + web | `adapter/common.ts` |
| `channelIdPayloadSchema` | server only | `server/common.ts` |
| `cancelRequestPayloadSchema` | server only | `server/common.ts` |
| `ChannelMetaCache` / `channelMetaCacheSchema` | server + web（via session:init） | `server/common.ts` |
| `errorMessagePayloadSchema` | 無外部使用者 | `server/common.ts`（有語意，保留） |
| `speechToTextMessagePayloadSchema` | 無外部使用者 | `server/common.ts`（有語意，保留） |
| `successResponseSchema` | 無外部使用者 | 內聯進使用它的 schema，不獨立 export |
| `clientMessageSchema` | 無外部使用者 | 刪除（summoner 有自己的定義） |
| `messageContentSchema` | 無外部使用者 | 刪除（無使用者） |

### index.ts 策略

- 所有跨邊界（2+ app）export 維持，只更新 import 路徑
- `clientMessageSchema`、`messageContentSchema`、`successResponseSchema` 從 index.ts 移除
- `preferencesStateSchema` 等 preferences exports 從 index.ts 移除
- 新路徑透明，external API 名稱不變

## Risks / Trade-offs

- [successResponseSchema 刪除後內部 schemas 要 inline] → 只影響 schemas 內部，TypeScript 驗證
- [clientMessageSchema 刪除] → 確認 summoner 只用自己的 schemas.ts 定義（已確認無外部使用者）
- [internal import 路徑全部更新] → 範圍限在 packages/schemas/src/，TypeScript 編譯驗證完整性
