## 1. 依賴替換

- [x] 1.1 在 `packages/file-watcher/package.json` 移除 `chokidar`，加入 `@parcel/watcher`
- [x] 1.2 執行 `pnpm install` 確認依賴安裝成功

## 2. 實作替換

- [x] 2.1 重寫 `packages/file-watcher/src/local-file-watcher.ts`，用 `@parcel/watcher` 取代 chokidar
- [x] 2.2 實作事件 type mapping：`create→add`、`update→change`、`delete→unlink`
- [x] 2.3 確保 absolute path 轉換為相對於 cwd 的 relative path
- [x] 2.4 確保同一個 cwd 多個 subscriber 共用一個 `@parcel/watcher` subscription
- [x] 2.5 確保最後一個 subscriber unsubscribe 時呼叫 `subscription.unsubscribe()`

## 3. 測試

- [x] 3.1 更新 `packages/file-watcher/src/__tests__/local-file-watcher.test.ts` 確保測試通過
- [x] 3.2 執行全部測試確認無 regression
