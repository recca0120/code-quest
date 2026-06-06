## Context

`DataSource` (in `packages/broadcaster/src/data-source.ts`) wires a `FileWatcher` subscription directly to a set of `onChange` callbacks. Every file event fires those callbacks immediately with no batching. `LocalBroadcaster.onSourceChange` dedups _concurrent_ reads via a `readPromise` guard, but it cannot deddup _sequential_ bursts: once the first read resolves, the second watcher event (which was ignored during the read) is already gone — a third event that arrives after the read completes triggers another full read cycle.

In practice, operations like a git checkout or Claude Code writing multiple files emit dozens of chokidar events within a 50–200 ms window, leading to 2–4 broadcast+snapshot cycles instead of one.

## Goals / Non-Goals

**Goals**
- Coalesce watcher events within a configurable window (default 80 ms) into a single `onChange` notification.
- Zero behaviour change for the common single-event case: if only one event arrives in a window, the callback fires after the delay.
- Debounce window is injectable for testing (avoid real timers in tests).

**Non-Goals**
- Do not debounce at the `LocalBroadcaster` level — that layer already has the `readPromise` guard and is not the right place for time-based coalescing.
- Do not change the `DataSourceLike` interface or affect `Broadcaster` callers.
- Do not accumulate/merge path data across events — `onChange` is a signal, not a payload.

## Decisions

### Decision: Debounce inside `DataSource` constructor, not in subclasses

Alternatives:
- Wrap the watcher subscription in each `FilesDataSource` / `GitDataSource` — would require repeating the logic in every subclass.
- Debounce in `LocalBroadcaster.onSourceChange` — already has the `readPromise` guard; adding time-based debounce there would conflate two concerns.

Chosen: single debounce in `DataSource` base class, transparent to all subclasses.

### Decision: Leading-edge OFF, trailing-edge ON (standard debounce)

The first event in a burst should NOT fire immediately — the goal is to wait for the burst to settle. Trailing-edge fires once after the last event in the window.

### Decision: Default window 80 ms, injectable via constructor option

`awaitWriteFinish.stabilityThreshold` in chokidar is already 100 ms. Using 80 ms sits inside that window so paired events (e.g. file rename = unlink + add) are always coalesced. The value is passed as a constructor parameter with a default, so `FilesDataSource` / others do not need to change their call sites.

### Decision: Timer cleared in `dispose()`

Prevents a stale callback firing after the data source is torn down (e.g. last subscriber for a cwd unsubscribes).

## Risks / Trade-offs

- [Latency] Every watcher notification now fires 80 ms later — UI refresh is slightly delayed. → Acceptable; the tree was already taking 50–200 ms to fetch + re-render. Net visible latency is unchanged or better.
- [Test complexity] Tests must use fake timers to advance the debounce window. → Use `vi.useFakeTimers()` after setup, same pattern as existing FsContext debounce tests.

## Migration Plan

No migration required. `DataSource` is an internal base class with no public API contract. Subclasses are instantiated inside `LocalBroadcaster.add()` factories — no call-site changes needed.

## Open Questions

None.
