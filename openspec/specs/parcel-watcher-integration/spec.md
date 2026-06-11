# parcel-watcher-integration Specification

## Purpose
TBD - created by archiving change replace-chokidar-with-parcel-watcher. Update Purpose after archive.
## Requirements
### Requirement: LocalFileWatcher uses @parcel/watcher instead of chokidar
`LocalFileWatcher` SHALL use `@parcel/watcher` as the underlying watch mechanism.
On macOS it SHALL use FSEvents (one stream per `subscribe()` call, not one fd per directory).
On Linux it SHALL use inotify recursive watch.
The public `FileWatcher` interface SHALL remain unchanged.

#### Scenario: Subscribe fires callback on file change
- **WHEN** a file inside the watched directory changes
- **THEN** the registered `WatchCallback` is called with `{ type, path }` where path is relative to the watched cwd

#### Scenario: FSWatcher handle count is O(1) per cwd
- **WHEN** a directory with 1000+ subdirectories is watched
- **THEN** the number of active FSWatcher handles in the process is equal to the number of distinct cwds subscribed, not the number of subdirectories

#### Scenario: Multiple subscribers share one underlying watcher per cwd
- **WHEN** two subscribers call `subscribe()` with the same cwd
- **THEN** only one `@parcel/watcher` subscription is created for that cwd

#### Scenario: Unsubscribe closes the underlying watcher when last subscriber leaves
- **WHEN** the last subscriber for a cwd calls its returned unsubscribe function
- **THEN** the `@parcel/watcher` subscription for that cwd is unsubscribed

### Requirement: Event type mapping from @parcel/watcher to WatchEvent
`LocalFileWatcher` SHALL map `@parcel/watcher` event types to the existing `WatchEvent` type.

#### Scenario: create event maps to add
- **WHEN** `@parcel/watcher` emits `type: 'create'` for a path
- **THEN** the callback receives `{ type: 'add', path }`

#### Scenario: update event maps to change
- **WHEN** `@parcel/watcher` emits `type: 'update'` for a path
- **THEN** the callback receives `{ type: 'change', path }`

#### Scenario: delete event maps to unlink
- **WHEN** `@parcel/watcher` emits `type: 'delete'` for a path
- **THEN** the callback receives `{ type: 'unlink', path }`

#### Scenario: paths are relative to cwd
- **WHEN** `@parcel/watcher` emits an event with an absolute path
- **THEN** the callback receives a path relative to the subscribed cwd

