## Why

`packages/schemas` 是 summoner、server、web 三方的共用合約層，確保任何 shape 變動都能在編譯期同步到所有使用方。但目前 `src/schemas/` 子目錄把所有 schema 平鋪在一起，沒有按資料流層級分類，難以判斷一個 schema 在合約裡的角色。

此外，少數 export 只有單一 app 使用，不符合「放 schemas = 多方合約」的原則，卻也混在其中。

## What Changes

- **`packages/schemas/src/` 目錄重組**為三層：`server/`（server ↔ client 合約）、`adapter/`（summoner ↔ server 合約，含原 `remote/` + `transport/`）、`shared/`（真正無歸屬的基礎建設）
- **`schemas/common.ts` 拆分**：有外部使用者的 export 按歸屬移到 `server/` 或 `adapter/`；無任何外部使用者的 export（`clientMessageSchema`、`messageContentSchema`、`successResponseSchema` 等）直接內聯或刪除
- **`preferences.ts` 移出 `packages/schemas`**：唯一確認只有 `apps/web` 使用的 schema，搬到 `apps/web/src/`
- **`packages/schemas/src/index.ts` 保持所有跨邊界 export 不變**（multi-party exports zero breaking change）；單方使用的 export 可移除

## Capabilities

### New Capabilities

- `schemas-layer-structure`: `packages/schemas` 內部按 server / adapter / shared 三層組織，每層只包含對應資料流角色的 schema；單方使用的 schema 移回各自 app

### Modified Capabilities

(none — 不改任何 schema 內容，不改多方共用的 public API)

## Impact

- `packages/schemas/src/` 內部 import 路徑全數更新
- `packages/schemas/src/index.ts` re-export 路徑更新，跨邊界 export 名稱不變
- `apps/web/src/` 新增 preferences schema，移除對 `@code-quest/schemas` 的 preferences import
- 無外部使用者的 export 從 index.ts 移除（`clientMessageSchema` 等）
