## Why

`SessionScanner` 目前直接依賴 `RawEventService`、`SessionStore`、`JsonlProjectScanner`、`JsonlDbReader`、`JsonlDbWriter`，混合了不同層次的具體實作。`importSession`/`exportSession` 的職責也放錯位置（應在 `SessionManager`）。

重構目標：讓每個物件只依賴它真正需要的抽象，filesystem 與 DB 兩側完全對稱。

## What Changes

新增三個抽象：

- `ProjectList` interface（jsonl-codec）— 列出 sessions、查詢是否存在、計算 event 數
- `Converter` class（jsonl-codec）— 封裝 reader → writer 的搬移操作
- `DbProjectList` class（server）— `ProjectList` 的 DB 實作

重構兩個現有類別：

- `SessionScanner` — 改為只依賴兩個 `ProjectList`（filesystem + DB），移除所有直接 DB 依賴
- `SessionManager` — 承接 `importSession`/`exportSession`，持有 `dbReader`、`dbWriter`、`filesystem`

## Capabilities

### New Capabilities
- `project-list-interface`: `ProjectList` interface + `Converter` class，讓 filesystem 與 DB 兩側對稱
- `db-project-list`: `DbProjectList` 實作，封裝 `RawEventService` + `SessionStore` 的 listing 邏輯

### Modified Capabilities
- `session-scanner`: 重構為只依賴 `ProjectList` 抽象，移除直接 DB 依賴
- `session-manager`: 承接 import/export 操作，職責邊界明確
