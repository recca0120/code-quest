# Tasks

## ChannelProvider.test.tsx — crash probes & weak assertions
- [x] 刪除 5 個 crash probe 測試（auth_url / bridge_state / unknown raw event / new_session_notification / open_in_editor / speech:message）
- [x] 修正 unmount 測試：改驗 component lifecycle 效果（unmount removes channel UI from DOM），不驗 stub 內部狀態
- [x] 刪除 settings:refresh_usage 測試（只驗 compose textarea 仍存在，無真實 assertion）

## actions-no-emit.test.tsx — 零 assertion
- [x] kill 測試補真實 assertion（驗 kill 不改變 cancelling 狀態，與 abort 行為區分）

## session-history + radix-tab-conversation — 跨檔重複
- [x] 抽取共用 helper（joinChannel / renderAndJoinB / setupClientWindows）到 channel-history-helpers.tsx
- [x] 合併或去除重複的「history 不顯示 Running/Done」測試 — verified: 非真重複，session-history 測 local_agent (task_notification + auto-complete)，radix-tab 測 sub-agent + local_bash，場景不同保留

## WorkspaceTopbar.test.tsx — 驗 wiring 不驗行為
- [x] 改 3 個測試（Settings / ToggleLeft / Search）驗 UI 效果而非 callback 被呼叫 — N/A：WorkspaceTopbar 元件及測試已在先前重構中移除

## WorkspaceLayoutRWD.test.tsx — 重複斷言
- [x] 合併兩個驗同一 element min-w-0 的測試為一個
- [x] 跨檔 ActivityBar 不存在斷言（4 個）保留一個（Desktop），其餘刪除

## 其他快速修
- [x] ToolBlock.test.tsx：改用 role/text query，不用 CSS class selector
- [x] ChannelContext.test.tsx：刪 expect(channelId).toBeTruthy()
- [x] ChannelComposeProvider.test.tsx：修正測試名與 expect 方向相反
- [x] RightPane.test.tsx：移除 spy browseEntries 呼叫次數，改驗 UI 不閃爍或不重新請求 — 已無 spy/呼叫次數斷言，全部改用 role/region 驗 UI
