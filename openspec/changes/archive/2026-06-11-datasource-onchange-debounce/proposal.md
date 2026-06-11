## Why

`DataSource.onChange` notifies subscribers on every individual `FileWatcher` event with no debounce. When chokidar fires several events in rapid succession (e.g. Claude Code writing a file batch), each event triggers a full read → broadcast → `files:dirty` socket emission → client tree invalidation. `FileTree` calls `item.invalidateChildrenIds(true)` on each snapshot, causing the tree to enter a loading state multiple times in a short window — during which `tree.getItems()` returns an empty array and the file pane visually disappears.

## What Changes

- Add a configurable debounce window to `DataSource` so that bursts of watcher events within the window fire `onChange` callbacks only once.
- The broadcaster/data-source package is the only change; no client-side code is modified.
- Existing `DataSource` subclasses (`FilesDataSource`, `GitDataSource`, `OpenspecDataSource`) inherit the fix automatically.

## Capabilities

### New Capabilities

- `broadcaster-datasource-debounce`: `DataSource` accumulates watcher events over a configurable debounce window (default 80 ms) and fires `onChange` callbacks once at the end of the window. Multiple events within the window produce a single notification.

### Modified Capabilities

<!-- none — no existing spec-level requirements are changing -->

## Impact

- **`packages/broadcaster/src/data-source.ts`** — add debounce timer; fire accumulated callbacks after window expires; clear timer on `dispose()`
- **`packages/broadcaster/src/__tests__/data-source.test.ts`** — new TDD tests using fake timers
- `LocalBroadcaster` behaviour is unchanged (still receives one `onChange` notification per burst; still skips concurrent reads via `readPromise` guard)
- No API surface change; `DataSourceLike` interface is unmodified
- Test kit `FakeFileWatcher` already supports per-cwd subscription; tests will use it directly
