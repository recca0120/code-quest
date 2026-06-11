## Context

`apps/summoner` 的 `LocalWatchService` 使用 chokidar，底層呼叫 Node.js `fs.watch`，在 macOS 上每個被 watch 的目錄都消耗一個 file descriptor，容易觸發 `EMFILE: too many open files`。

`@parcel/watcher` 在 macOS 上走 FSEvents、在 Linux 上走 inotify recursive watch，不需要為每個子目錄分別開 fd，根本解決此問題。

prebuilt binary 透過 npm optionalDependencies 機制發布，但 release 執行檔不走 npm install，需要與 better-sqlite3 同樣的 startup 下載邏輯。

## Goals / Non-Goals

**Goals:**
- 替換 chokidar，解決 EMFILE 問題
- release 啟動腳本（server.sh / summoner.sh）支援自動下載 `@parcel/watcher` native addon

**Non-Goals:**
- 改變 `WatchService` 的公開 API（介面不變）
- 處理 Windows（`.bat` 腳本目前不在範圍內，shell script 優先）

## Decisions

**`@parcel/watcher` API 對應：**
- `subscribe(dir, callback)` → 直接對應現有 `WatchService.subscribe(cwd, cb)`
- 回傳的 subscription 有 `.unsubscribe()` → 封裝成現有的 `Unsubscribe` 函式
- 事件格式 `{ type, path }` 與現有 `WatchEvent` 相同（type 值相同：`create`→`add`，需確認 mapping）

**prebuilt 路徑：**
- package 名稱：`@parcel/watcher-{os}-{arch}`（e.g. `@parcel/watcher-darwin-arm64`）
- binary 路徑：`node_modules/@parcel/watcher-{os}-{arch}/watcher.node`
- release 放置位置：`node_modules/@parcel/watcher-{os}-{arch}/watcher.node`（與 npm 安裝一致）
- GitHub Releases URL：`https://github.com/parcel-bundler/watcher/releases/download/v{VERSION}/{pkg}.node`

**啟動腳本邏輯：**
summoner 也需要 watch 功能（它是 fs-watch 的實際使用者），所以 prebuilt 下載加在 `summoner.sh` 裡。server 不使用 watch，不需要改。

## Risks / Trade-offs

- `@parcel/watcher` 的事件 type 名稱與 chokidar 不同（`create` vs `add`），需要 mapping
- Linux musl（Alpine）需要不同的 binary，啟動腳本需要偵測 libc 類型
