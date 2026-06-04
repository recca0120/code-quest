## Context

The browser-side state management accumulates data across several dimensions without bounds: channel message history grows with every message and every reconnect replay; the git status query cache never evicts entries; feature handlers in `buildMessagesActions` are re-registered on every `useMemo` rebuild rather than once at mount; and `partialInput` strings on tool_use blocks survive session aborts. Together these cause steady memory growth during extended use.

## Goals / Non-Goals

**Goals:**
- Cap in-memory messages per channel to 500 (rolling window)
- Cap `historyMessages` to 100 entries
- Ensure feature handlers are registered once at mount, cleaned up at unmount
- Add `evict(key)` to query cache; call it when last git-status subscriber leaves
- Clear `partialInput` on session abort/close

**Non-Goals:**
- Persisting message history to IndexedDB or disk (separate concern)
- Virtualising the message list DOM (rendering concern, not memory)
- Capping the number of open tabs (UX decision outside this change)

## Decisions

### 1. Message cap: 500 messages, slice on write

Apply `messages = messages.slice(-MAX_MESSAGES)` after each batch write in `applyHistoryBatch` and after each append. 500 is sufficient for a usable scroll-back while keeping a single channel well under 10 MB of JS heap in typical use.

**Alternative considered**: Evict lazily on read (only trim when rendering). Rejected — memory is consumed whether or not the user scrolls up, so trimming on write is strictly better.

### 2. Registry registration: useEffect at mount, not useMemo

Move the `buildMessagesActions` registry.register() calls out of `useMemo` and into a `useEffect(() => { ...; return cleanup; }, [channelId])`. The actions object itself remains in `useMemo` but only contains the action functions — no side effects.

**Alternative considered**: Stable registry with idempotent register (skip if already registered). Rejected — harder to reason about cleanup; a single useEffect is the React-idiomatic approach.

### 3. Query cache eviction: subscriber ref-count

`createQueryCache` gains an `evict(key)` method (`cache.delete(key)`). `GitProvider`'s `subscribeGitStatusChange` already tracks subscriber sets per cwd; when a set goes to zero, call `evict(cwd)`.

### 4. partialInput cleanup: clear on session close event

In the channel message reducer, handle the `session:closed` / abort signal by scanning `state.messages` for any `{ type: 'tool_use' }` block with a non-undefined `partialInput` and setting it to `undefined`. This is a single O(n) scan and only runs on close/abort, not on every message.

## Risks / Trade-offs

- [Risk] Users with very long conversations lose scroll-back history beyond 500 messages → Mitigation: 500 is generous for typical use; a "load more" feature can be added later if needed
- [Risk] useEffect timing: handlers not ready before first message arrives → Mitigation: messages that arrive before the effect fires are processed after mount via the existing state replay mechanism
- [Risk] evict() on last-subscriber-unsubscribe races with a new subscriber in strict-mode double-effect → Mitigation: the new subscription immediately triggers a fresh fetch on cache miss, so correctness is maintained

## Open Questions

- Should the message cap be configurable (e.g. via a dev-only setting)? Current answer: no — hardcode 500 and revisit if users report issues.
