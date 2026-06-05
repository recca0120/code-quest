## Why

Browser memory usage grows unboundedly during extended use — long conversations, multiple open tabs, and reconnections each compound the problem. Left unaddressed, this causes sluggish UI, tab crashes, and a degraded experience for power users.

## What Changes

- Cap the `messages` array per channel to a rolling window (e.g. 500 messages); older messages are dropped from the in-memory store
- Cap `historyMessages` (compose input history) to a sensible bound
- Fix `buildMessagesActions` so feature handlers are registered once at mount and cleaned up at unmount, not re-registered on every `useMemo` rebuild
- Add an eviction path to `createQueryCache` (git status cache) so entries are removed when their last subscriber unsubscribes
- Clear `partialInput` on all in-progress tool_use blocks when a session is aborted or closed unexpectedly

## Capabilities

### New Capabilities

- `channel-message-cap`: Rolling window limit on in-memory messages per channel — oldest messages are discarded when the cap is exceeded
- `git-status-cache-eviction`: Query cache entries for git status are evicted when no subscribers remain for a given cwd

### Modified Capabilities

- `channel-streaming`: `partialInput` on tool_use blocks is cleared on session abort/close to prevent orphaned string accumulation

## Impact

- `apps/web/src/contexts/channel/ChannelMessagesContext.tsx` — message cap + registry fix
- `apps/web/src/contexts/channel/handlers/streaming.ts` — partialInput cleanup on close
- `apps/web/src/utils/query-cache.ts` — add evict() method
- `apps/web/src/contexts/GitContext.tsx` — call evict() on unsubscribe
