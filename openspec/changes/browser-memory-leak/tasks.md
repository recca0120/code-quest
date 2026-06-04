## 1. Registry fix — register handlers once at mount

- [ ] 1.1 Read `ChannelMessagesContext.tsx` and identify all `registry.register()` calls inside `buildMessagesActions` / `useMemo`
- [ ] 1.2 Write failing test: mounting the same channel twice should not double the handler count
- [ ] 1.3 Extract registration side effects out of `useMemo` into a `useEffect(() => { ...; return cleanup; }, [channelId])` so handlers are registered once and cleaned up on unmount
- [ ] 1.4 Verify test passes; confirm existing channel context tests still green

## 2. Message cap — rolling window of 500

- [ ] 2.1 Write failing tests for `applyHistoryBatch`: 300 messages stays at 300, 600 messages is trimmed to 500 (most recent)
- [ ] 2.2 Add `const MAX_MESSAGES = 500` constant and apply `messages.slice(-MAX_MESSAGES)` in `applyHistoryBatch`
- [ ] 2.3 Write failing test: streaming a 501st message to a full channel drops the oldest
- [ ] 2.4 Apply the same cap to incremental append paths in the streaming handler
- [ ] 2.5 Write failing test: `historyMessages` caps at 100
- [ ] 2.6 Apply `historyMessages.slice(-100)` in the compose history accumulation logic
- [ ] 2.7 Run all channel context tests; confirm green

## 3. partialInput cleanup on abort/close

- [ ] 3.1 Write failing test: after a session abort event, all tool_use blocks have `partialInput === undefined`
- [ ] 3.2 Add a reducer case (or handler) for `session:closed` / abort that scans messages and clears `partialInput` on any tool_use block where it is set
- [ ] 3.3 Write failing test: unexpected session close (network drop) also clears `partialInput`
- [ ] 3.4 Confirm existing streaming tests still pass

## 4. Git status cache eviction

- [ ] 4.1 Write failing test for `createQueryCache`: calling `evict(key)` removes the cached entry
- [ ] 4.2 Add `evict(key: string): void` method to `createQueryCache` (`cache.delete(key)`)
- [ ] 4.3 Write failing test: `subscribeGitStatusChange` calls `evict(cwd)` when the last subscriber unsubscribes
- [ ] 4.4 In `GitProvider`, call `statusStore.evict(cwd)` inside the unsubscribe callback when subscriber count reaches zero
- [ ] 4.5 Run git context tests; confirm green

## 5. Final verification

- [ ] 5.1 Run full web test suite (`pnpm --filter @code-quest/web test --run`); all tests green
- [ ] 5.2 Manual smoke test: open a long conversation, check DevTools Memory tab — heap no longer grows unboundedly on reconnect
