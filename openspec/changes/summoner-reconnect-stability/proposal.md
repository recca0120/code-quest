## Why

When the remote summoner (Claude Code CLI) disconnects and reconnects, two problems occur:

1. **Server crash**: `RemoteBroadcaster.subscribe` calls `void this.rpc.request(watch.start)` without `.catch()`. When the summoner is not connected, the rejected promise becomes an unhandled promise rejection — Node 23 treats this as a fatal error and crashes the server.

2. **Silent watch loss**: After summoner reconnects, `ReconnectableRpc.replace()` re-wires event listeners but `RemoteBroadcaster` never re-sends `watch.start` for its active subscriptions. The client remains subscribed on the web side but receives no snapshots — file pane, git status, and openspec pane silently freeze until the user refreshes.

3. **No client visibility**: The server already broadcasts `remote:status { connected }` to all sockets on summoner connect/disconnect, but the web client never listens to this event. The user sees frozen panes with no explanation.

## What Changes

- `RemoteBroadcaster`: add `.catch()` to `watch.start` fire-and-forget call to prevent crash
- `ReconnectableRpc`: emit a `reconnect` event after `replace()` re-wires listeners
- `RemoteBroadcaster`: listen to `reconnect` event and re-send `watch.start` for all active cwds
- Web client: add `useRemoteStatus` hook listening to `remote:status` socket event; display a dismissible banner when summoner is offline

## Capabilities

### Modified Capabilities
- `broadcaster-datasource`: `RemoteBroadcaster` survives summoner reconnects — active watch subscriptions are automatically restored
- `remote-summoner-status`: client reflects summoner connection state with a visible offline banner

## Impact

- `apps/server/src/remote/reconnectable-rpc.ts` — emit `reconnect` event in `replace()`
- `apps/server/src/remote/remote-broadcaster.ts` — add `.catch()` to `watch.start`; subscribe to `reconnect` and re-send `watch.start` for active cwds
- `apps/web/src/contexts/SocketContext.tsx` (or new hook) — listen to `remote:status` event
- `apps/web/src/components/ui/RemoteStatusBanner.tsx` (new) — dismissible offline banner
