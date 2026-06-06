## Context

The server uses `ReconnectableRpc` as a stable event bus that survives summoner WS reconnects. When the summoner connects, `server.ts` calls `reconnectableRpc.replace(rpc)` and `broadcastRemoteStatus(c, true)`; on disconnect it calls `broadcastRemoteStatus(c, false)`.

`RemoteBroadcaster` holds a map of `cwd → subscriberMap` and sends `watch.start` to the summoner on first subscribe per cwd. On summoner reconnect, `ReconnectableRpc.replace()` re-wires event listeners but `RemoteBroadcaster` is never told a new summoner arrived — so active subscriptions are silently dead until the socket client unsubscribes and re-subscribes (i.e., page refresh).

The web client already receives `remote:status { connected }` from the server (via `broadcastRemoteStatus`) but nothing in the client reads this event.

## Goals / Non-Goals

**Goals**
- Prevent server crash when summoner is absent and `watch.start` rejects.
- Automatically restore watch subscriptions when summoner reconnects.
- Show a visible offline banner on the client when summoner is disconnected.

**Non-Goals**
- Do not retry individual RPC calls on failure — reconnect re-subscription is the recovery path.
- Do not change the `DataSourceLike` interface or `LocalBroadcaster`.
- Do not buffer snapshots during summoner absence.

## Decisions

### Decision: `ReconnectableRpc` emits a `reconnect` event in `replace()`

Alternatives:
- `server.ts` calls `broadcaster.resubscribeAll()` directly after `replace()` — couples the startup/reconnect wiring to broadcaster internals; caller must know to do this.
- `RemoteBroadcaster` polls `rpc.connected` — wasteful and brittle.

Chosen: `ReconnectableRpc.replace()` fires a synthetic `reconnect` event through `persistentListeners` after re-wiring. `RemoteBroadcaster` registers a persistent `reconnect` handler in its constructor and re-sends `watch.start` for all active cwds. Both sides stay decoupled.

### Decision: `watch.start` failure is logged, not surfaced to subscriber

The subscriber callback cannot do anything useful with a "summoner offline" error at subscribe time — the reconnect handler will fix it automatically. Log at `warn` level and move on.

### Decision: Client banner, not inline pane error

Summoner disconnect affects all panes simultaneously. A single top-level banner is less disruptive than three separate error states in file/git/openspec panes. The banner auto-dismisses when summoner reconnects (`remote:status { connected: true }`).

### Decision: `useRemoteStatus` as a module-level hook, banner as a standalone component

`useSocket` is the existing pattern for socket access. `useRemoteStatus` follows the same convention: reads from `SocketContext`, subscribes to `remote:status`, returns `{ connected: boolean }`. The banner component is separate so it can be placed in the app shell without coupling to any pane.

## Risks / Trade-offs

- [Re-subscribe race] If two `watch.start` RPCs for the same cwd arrive at the summoner before the first one resolves, there could be double-subscription. The summoner's ref-counted `watch.start/stop` design handles this correctly (idempotent per cwd).
- [Banner flicker] Brief summoner restarts (< 1 s) will flash the banner. Acceptable; a debounce on the `connected → false` transition could be added later if it proves annoying.

## Open Questions

None.
