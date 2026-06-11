## 1. 確認移除安全性

- [x] 1.1 確認 `clientMessageSchema`、`messageContentSchema`、`successResponseSchema` 在 packages/schemas 內部的使用位置，決定是刪除還是內聯
- [x] 1.2 確認 `preferences.ts` 所有 export 只有 `apps/web` 使用（已確認，記錄在此）

## 2. 建立新目錄結構

- [x] 2.1 建立 `packages/schemas/src/server/` 目錄
- [x] 2.2 建立 `packages/schemas/src/adapter/` 目錄
- [x] 2.3 建立 `packages/schemas/src/shared/` 目錄

## 3. 搬移 adapter/ 層

- [x] 3.1 將 `remote/` 整個移到 `adapter/remote/`
- [x] 3.2 將 `transport/` 整個移到 `adapter/transport/`
- [x] 3.3 建立 `adapter/common.ts`，從 `schemas/common.ts` 移入 `ControlResponse`、`controlResponseSchema`（三方共用）

## 4. 拆分 schemas/common.ts

- [x] 4.1 建立 `server/common.ts`，移入 server-layer exports：`channelIdPayloadSchema`、`cancelRequestPayloadSchema`、`channelMetaCacheSchema`、`ChannelMetaCache`、`errorMessagePayloadSchema`、`speechToTextMessagePayloadSchema`
- [x] 4.2 刪除 `clientMessageSchema`、`messageContentSchema`（無外部使用者，inline 進 session.ts）
- [x] 4.3 處理 `successResponseSchema`：無任何使用者，從 index.ts 移除
- [x] 4.4 `schemas/common.ts` 改為 re-export shim（內容已移走）

## 5. 搬移 server/ 層

- [x] 5.1 將 `schemas/message-blocks.ts` 移到 `server/blocks.ts`（ContentBlock 是 server↔client 合約）
- [x] 5.2 將根層 `socket-events.ts` 移到 `server/socket-events.ts`
- [x] 5.3 將 `schemas/rpc.ts` 移到 `server/rpc.ts`
- [x] 5.4 將 `schemas/permission-mode.ts` 移到 `server/permission-mode.ts`
- [x] 5.5 將其餘 `schemas/*.ts` 批次移到 `server/`（actions、auth、control、control-response、fs、fs-dirty、git、hook、mcp、message、message-meta、message-payloads、message-stats、message-stream、notification、openspec、plan、plugin、projects、provider、question、session、settings、system、task、terminal、worktree）

## 6. 更新 schemas 內部 import 路徑

- [x] 6.1 更新所有搬移後檔案內部的相對 import，反映新路徑
- [x] 6.2 確認 `server/fs-dirty.ts` 的 `@code-quest/filesystem` 和 `server/git.ts` 的 `@code-quest/git` import 正確

## 7. 搬移 preferences 到 apps/web

- [x] 7.1 建立 `apps/web/src/stores/preferences-schema.ts`，複製 preferences.ts 內容
- [x] 7.2 將 `packages/schemas/src/schemas/__tests__/preferences.test.ts` 移到 `apps/web/src/stores/__tests__/preferences-schema.test.ts`
- [x] 7.3 更新 `apps/web/src/` 所有 import preferences 的檔案，改從本地路徑
- [x] 7.4 刪除 `packages/schemas/src/schemas/preferences.ts`

## 8. 更新 index.ts

- [x] 8.1 更新所有 re-export 路徑指向新位置（server/、adapter/、shared/）
- [x] 8.2 移除零消費者 export（`clientMessageSchema`、`messageContentSchema`、`successResponseSchema`）
- [x] 8.3 移除 preferences exports（`preferencesStateSchema`、`colorThemeSchema`、`fontSizeSchema`、`DISMISSIBLE_IDS`）
- [x] 8.4 確認所有多方共用 export 仍然存在且名稱不變

## 9. 驗證

- [x] 9.1 `npx tsc --project packages/schemas/tsconfig.json --noEmit` 無錯誤
- [x] 9.2 `npx tsc --project apps/summoner/tsconfig.json --noEmit` 無錯誤
- [x] 9.3 `npx tsc --project apps/server/tsconfig.json --noEmit` 無錯誤
- [x] 9.4 `npx tsc --project apps/web/tsconfig.json --noEmit` 無錯誤
- [x] 9.5 執行 packages/schemas 測試確認無 regression（95/95），server 752/752
