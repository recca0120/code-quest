## 1. `ReconnectableRpc` — emit `reconnect` event (TDD)

- [ ] 1.1 Write test: `replace()` triggers handlers registered via `on('reconnect', ...)`
- [ ] 1.2 Write test: `reconnect` handler fires on second `replace()` (summoner reconnects)
- [ ] 1.3 Write test: `reconnect` handler does NOT fire before any `replace()` call
- [ ] 1.4 Confirm new tests fail (red)
- [ ] 1.5 Implement: call persistent `reconnect` listeners at end of `replace()`
- [ ] 1.6 Confirm tests pass (green)

## 2. `RemoteBroadcaster` — crash fix + reconnect re-subscribe (TDD)

- [ ] 2.1 Write test: `watch.start` rejection does NOT cause unhandled promise rejection (server does not crash)
- [ ] 2.2 Write test: after reconnect event, active cwds each receive a new `watch.start` RPC
- [ ] 2.3 Write test: cwds with no active subscribers do NOT receive `watch.start` on reconnect
- [ ] 2.4 Confirm new tests fail (red)
- [ ] 2.5 Implement: add `.catch(err => logger.warn(...))` to `watch.start` call
- [ ] 2.6 Implement: in constructor, `rpc.on('reconnect', ...)` → re-send `watch.start` for active cwds
- [ ] 2.7 Confirm tests pass (green)

## 3. Web client — `useRemoteStatus` hook + banner (TDD)

- [ ] 3.1 Write test: initial state is `{ connected: true }` (assume connected until told otherwise)
- [ ] 3.2 Write test: `remote:status { connected: false }` sets state to disconnected
- [ ] 3.3 Write test: `remote:status { connected: true }` after disconnect restores connected state
- [ ] 3.4 Confirm new tests fail (red)
- [ ] 3.5 Implement `useRemoteStatus` hook in `apps/web/src/hooks/useRemoteStatus.ts`
- [ ] 3.6 Confirm hook tests pass (green)
- [ ] 3.7 Add `RemoteStatusBanner` component — shows only when `!connected`, auto-hides on reconnect
- [ ] 3.8 Mount banner in app shell (e.g. `App.tsx` or top-level layout)
- [ ] 3.9 Smoke-test manually: disconnect summoner → banner appears; reconnect → banner disappears

## 4. Verify

- [ ] 4.1 Run full server test suite — no regressions
- [ ] 4.2 Run full web test suite — no regressions
