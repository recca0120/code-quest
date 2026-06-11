## Why

macOS 預設 file descriptor 上限（256）太低，chokidar 底層使用 `fs.watch`，每個被 watch 的目錄都會消耗一個 fd，在大型專案中很快觸發 `EMFILE: too many open files` 錯誤。

`@parcel/watcher` 在 macOS 上使用 FSEvents（kernel-level），在 Linux 上使用 inotify recursive watch，不需要為每個子目錄分別開 fd，根本上解決這個問題。

## What Changes

- 將 `apps/summoner` 的 `LocalWatchService` 從 chokidar 換成 `@parcel/watcher`
- 在 prebuilt 下載腳本中加入 `@parcel/watcher` 的 native addon 處理，使 release 執行檔也能正常運作
- 移除 chokidar 依賴

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
<!-- none — 行為不變，只是底層實作替換 -->

## Impact

- `apps/summoner/package.json`：移除 `chokidar`，加入 `@parcel/watcher`
- `apps/summoner/src/fs-watch/local.ts`：重寫使用 `@parcel/watcher` API
- prebuilt 下載腳本：加入 `@parcel/watcher-{platform}-{arch}` 的 binary 處理
