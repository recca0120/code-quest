# Layout Persistence — Proposal

## Problem Statement

Browser reload 時，workspace 的 tab 結構與 pane 配置完全消失，使用者必須重新手動建立 layout。多裝置情境下（例如同一帳號開兩個瀏覽器視窗），各裝置的 layout 狀態也無法同步。

## Solution Summary

在 server 端以 memory-only 的 `LayoutStore` 儲存每個 summoner 的 `PersistedLayout` JSON blob。整合點：

- **Browser reload**：`app:init` ACK 直接帶回 `layout: PersistedLayout | null`（不另立 `layout:load` 事件），client 收到後 rehydrate TabContext。
- **Client 儲存**：TabContext 狀態變動後，debounced（500 ms）emit `layout:save`；server 存入 LayoutStore，再以 `socket.broadcast.emit("layout:sync")` 通知同一 summoner 的其他 socket。
- **跨裝置更新**：收到 `layout:sync` 後，client 以新 layout 取代目前 TabContext 狀態（last-write-wins）。

`ChannelManager`（管 sessions）與 `LayoutStore`（管 layout）分開維護，兩者各自 SRP。

## Scope

**In scope：**
- `packages/schemas`：新增 `PersistedLayout` Zod schema
- `app:init` response schema 加入 `layout?: PersistedLayout`
- Server `LayoutStore` class（memory-only，`get` / `set`）
- Server WS handler：`layout:save`（存入 + broadcast `layout:sync`）
- Server `app:init` handler 帶回 `layout: store.get(summonerId) ?? null`
- Client `app:init` ACK rehydrate TabContext（tabs + activeTabId）
- Client TabContext debounced `layout:save` emit
- Client `layout:sync` 收到後更新 TabContext

**Out of scope：**
- DB 持久化（layout 僅保存於 server process 記憶體）
- Layout 版本歷史或 undo/redo
- Layout 合併策略（衝突一律 last-write-wins）

## Dependencies

此 change 必須在 `workspace-tab-split-pane` change 完成後才能開始實作。`remove-session-bar` change 依賴本 change。
